// check-tables.js
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

const supabase_admin = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function exploreDatabase() {
    console.log('=== Supabase Database Explorer ===\n');
    
    // First, let's check what tables exist
    console.log('1. Listing all tables in public schema...');
    
    try {
        // Method 1: Check information schema
        const { data: tables, error: tablesError } = await supabase_admin
            .from('information_schema.tables')
            .select('table_name')
            .eq('table_schema', 'public');
        
        if (tablesError) {
            console.log('❌ Cannot access information_schema:', tablesError.message);
            console.log('This is normal - need service role key for system tables');
        } else if (tables.length === 0) {
            console.log('No tables found in public schema.');
        } else {
            console.log(`Found ${tables.length} table(s):`);
            tables.forEach(table => {
                console.log(`  - ${table.table_name}`);
            });
        }
        
        // Method 2: Try to create 'users' table if it doesn't exist
        console.log('\n2. Checking/Creating "users" table...');
        
        // First, let's check if we can query the table
        const { error: queryError } = await supabase_admin
            .from('users')
            .select('*')
            .limit(1);
        
        if (queryError) {
            console.log(`Table "users" error: ${queryError.message}`);
            console.log('This usually means the table does not exist.');
            
            // Let's try to create it with a simple insert
            console.log('\n3. Attempting to create table via insert...');
            const { data: insertData, error: insertError } = await supabase_admin
                .from('users')
                .insert([
                    {
                        username: 'john.doe',
                        password: 'password123',
                        public_key: 'demo-public-key'
                    }
                ])
                .select();  // Add .select() to get the inserted data back
            
            if (insertError) {
                console.log('❌ Insert failed:', insertError.message);
                console.log('\nYou need to create the table first in Supabase dashboard.');
                console.log('Go to: https://app.supabase.io → Table Editor → New Table');
                console.log('\nOr run this SQL in SQL Editor:');
                console.log(`
                    CREATE TABLE users (
                        id BIGSERIAL PRIMARY KEY,
                        username TEXT,
                        password TEXT,
                        email TEXT,
                        created_at TIMESTAMP DEFAULT NOW()
                    );
                `);
            } else {
                console.log('✅ Table created and data inserted:', insertData);
            }
        } else {
            console.log('✅ Table "users" exists!');
            
            // Try to insert data
            console.log('\n4. Inserting test data into existing table...');
            const { data: insertedData, error: insertError } = await supabase_admin
                .from('users')
                .insert([
                    {
                        username: 'test_user_' + Date.now(),
                        password: 'test_pass',
                        public_key: 'demo-public-key'
                    }
                ])
                .select();
            
            if (insertError) {
                console.log('❌ Insert error:', insertError.message);
                console.log('Possible issues:');
                console.log('  - Missing required columns');
                console.log('  - Duplicate unique constraints');
                console.log('  - Row Level Security (RLS) blocking insert');
            } else {
                console.log('✅ Data inserted successfully:', insertedData);
            }
        }
        
        // Finally, query all data from users table
        console.log('\n5. Querying all users...');
        const { data: allUsers, error: finalError } = await supabase_admin 
            .from('users')
            .select('*');
        
        if (finalError) {
            console.log('Query error:', finalError.message);
        } else {
            console.log(`Found ${allUsers.length} user(s):`);
            console.log(allUsers);
        }
        
    } catch (error) {
        console.error('Unexpected error:', error);
    }
}

exploreDatabase();  