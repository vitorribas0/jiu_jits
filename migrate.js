#!/usr/bin/env node

require('dotenv').config({ path: '.env.local' });

const mongoose = require('mongoose');
const { createClient } = require('@supabase/supabase-js');
const { v4: uuidv4 } = require('uuid');

// MongoDB
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/gavioes';

// Supabase
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ SUPABASE_URL ou SUPABASE_KEY não configuradas');
  console.error('Certifique-se de que .env.local está preenchido');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Mapa ObjectId → UUID (pra manter referências)
const idMap = new Map();

async function migrateData() {
  console.log('🚀 Iniciando migração MongoDB → Supabase...\n');

  try {
    // Conectar ao MongoDB
    console.log('📦 Conectando ao MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ MongoDB conectado\n');

    const db = mongoose.connection.db;

    // 1. USERS
    console.log('👥 Migrando usuários...');
    const usersCollection = db.collection('users');
    const users = await usersCollection.find({}).toArray();

    for (const user of users) {
      const uuid = uuidv4();
      idMap.set(user._id.toString(), uuid);

      const { error } = await supabase.from('users').insert([
        {
          id: uuid,
          name: user.name,
          email: user.email,
          password: user.password,
          cpf: user.cpf,
          phone: user.phone,
          birth_date: user.birthDate ? new Date(user.birthDate).toISOString() : new Date().toISOString(),
          role: user.role || 'aluno',
          belt: user.belt || 'branca',
          degree: user.degree ?? 0,
          belt_updated_at: user.beltUpdatedAt ? new Date(user.beltUpdatedAt).toISOString() : new Date().toISOString(),
          emergency_contact: user.emergencyContact || { name: '', phone: '' },
          active: user.active !== false,
          created_at: user.createdAt ? new Date(user.createdAt).toISOString() : new Date().toISOString(),
          updated_at: user.updatedAt ? new Date(user.updatedAt).toISOString() : new Date().toISOString(),
        },
      ]);

      if (error) {
        console.error(`  ❌ Erro ao inserir usuário ${user.email}:`, error.message);
      }
    }
    console.log(`✅ ${users.length} usuários migrados\n`);

    // 2. ACADEMIES
    console.log('🏢 Migrando academias...');
    const academiesCollection = db.collection('academies');
    const academies = await academiesCollection.find({}).toArray();

    const academyMap = new Map();
    for (const academy of academies) {
      const uuid = uuidv4();
      academyMap.set(academy._id.toString(), uuid);

      const { error } = await supabase.from('academies').insert([
        {
          id: uuid,
          name: academy.name,
          address: academy.address,
          latitude: academy.latitude,
          longitude: academy.longitude,
          check_in_radius: academy.checkInRadius || 150,
          active: academy.active !== false,
          created_at: academy.createdAt ? new Date(academy.createdAt).toISOString() : new Date().toISOString(),
          updated_at: academy.updatedAt ? new Date(academy.updatedAt).toISOString() : new Date().toISOString(),
        },
      ]);

      if (error) {
        console.error(`  ❌ Erro ao inserir academia ${academy.name}:`, error.message);
      }
    }
    console.log(`✅ ${academies.length} academias migradas\n`);

    // 3. CLASSES
    console.log('🥋 Migrando turmas...');
    const classesCollection = db.collection('classes');
    const classes = await classesCollection.find({}).toArray();

    const classMap = new Map();
    for (const cls of classes) {
      const uuid = uuidv4();
      classMap.set(cls._id.toString(), uuid);

      const professorUuid = idMap.get(cls.professor.toString());
      const academyUuid = academyMap.get(cls.academy.toString());

      if (!professorUuid || !academyUuid) {
        console.warn(`  ⚠️  Turma ${cls.name} tem referência inválida, pulando`);
        continue;
      }

      const { error } = await supabase.from('classes').insert([
        {
          id: uuid,
          name: cls.name,
          description: cls.description || null,
          professor_id: professorUuid,
          academy_id: academyUuid,
          days: cls.days || [],
          start_time: cls.startTime,
          end_time: cls.endTime,
          max_students: cls.maxStudents || null,
          image: cls.image || null,
          active: cls.active !== false,
          created_at: cls.createdAt ? new Date(cls.createdAt).toISOString() : new Date().toISOString(),
          updated_at: cls.updatedAt ? new Date(cls.updatedAt).toISOString() : new Date().toISOString(),
        },
      ]);

      if (error) {
        console.error(`  ❌ Erro ao inserir turma ${cls.name}:`, error.message);
      }

      // 3b. Migrar students (array → table junction)
      if (cls.students && cls.students.length > 0) {
        const enrollments = cls.students
          .map(studentId => ({
            class_id: uuid,
            student_id: idMap.get(studentId.toString()),
          }))
          .filter(e => e.student_id); // Remove referências inválidas

        if (enrollments.length > 0) {
          const { error: enrollError } = await supabase
            .from('class_students')
            .insert(enrollments);

          if (enrollError) {
            console.error(`  ⚠️  Erro ao inserir matriculados da turma ${cls.name}:`, enrollError.message);
          }
        }
      }
    }
    console.log(`✅ ${classes.length} turmas migradas\n`);

    // 4. CHECK-INS
    console.log('✅ Migrando check-ins...');
    const checkInsCollection = db.collection('checkins');
    const checkIns = await checkInsCollection.find({}).toArray();

    for (const ci of checkIns) {
      const studentUuid = idMap.get(ci.student.toString());
      const classUuid = classMap.get(ci.class.toString());
      const academyUuid = academyMap.get(ci.academy.toString());

      if (!studentUuid || !classUuid || !academyUuid) {
        console.warn(`  ⚠️  Check-in inválido, pulando`);
        continue;
      }

      const { error } = await supabase.from('check_ins').insert([
        {
          id: uuidv4(),
          student_id: studentUuid,
          class_id: classUuid,
          academy_id: academyUuid,
          check_in_time: ci.checkInTime ? new Date(ci.checkInTime).toISOString() : new Date().toISOString(),
          location: ci.location || { latitude: 0, longitude: 0 },
          distance_meters: ci.distanceMeters || 0,
          status: ci.status || 'presente',
          approval: ci.approval || 'pendente',
          approved_by: ci.approvedBy ? idMap.get(ci.approvedBy.toString()) : null,
          approved_at: ci.approvedAt ? new Date(ci.approvedAt).toISOString() : null,
          created_at: ci.createdAt ? new Date(ci.createdAt).toISOString() : new Date().toISOString(),
          updated_at: ci.updatedAt ? new Date(ci.updatedAt).toISOString() : new Date().toISOString(),
        },
      ]);

      if (error) {
        console.error(`  ❌ Erro ao inserir check-in:`, error.message);
      }
    }
    console.log(`✅ ${checkIns.length} check-ins migrados\n`);

    // 5. PHOTOS
    console.log('📸 Migrando fotos...');
    const photosCollection = db.collection('photos');
    const photos = await photosCollection.find({}).toArray();

    for (const photo of photos) {
      const classUuid = classMap.get(photo.class.toString());
      const uploadedByUuid = idMap.get(photo.uploadedBy.toString());

      if (!classUuid || !uploadedByUuid) {
        console.warn(`  ⚠️  Foto inválida, pulando`);
        continue;
      }

      const { error } = await supabase.from('photos').insert([
        {
          id: uuidv4(),
          class_id: classUuid,
          uploaded_by: uploadedByUuid,
          taken_at: photo.takenAt ? new Date(photo.takenAt).toISOString() : new Date().toISOString(),
          caption: photo.caption || null,
          storage: photo.storage || 'db',
          url: photo.url || null,
          public_id: photo.publicId || null,
          data: photo.data ? photo.data.toString('base64') : null,
          content_type: photo.contentType || 'image/jpeg',
          bytes: photo.bytes || 0,
          active: photo.active !== false,
          created_at: photo.createdAt ? new Date(photo.createdAt).toISOString() : new Date().toISOString(),
          updated_at: photo.updatedAt ? new Date(photo.updatedAt).toISOString() : new Date().toISOString(),
        },
      ]);

      if (error) {
        console.error(`  ❌ Erro ao inserir foto:`, error.message);
      }
    }
    console.log(`✅ ${photos.length} fotos migradas\n`);

    console.log('🎉 MIGRAÇÃO COMPLETA!');
    console.log(`
✅ ${users.length} usuários
✅ ${academies.length} academias
✅ ${classes.length} turmas
✅ ${checkIns.length} check-ins
✅ ${photos.length} fotos
    `);

  } catch (error) {
    console.error('❌ Erro durante migração:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('Desconectado do MongoDB');
  }
}

migrateData();
