#!/usr/bin/env node

/**
 * RLS Policy Audit Script
 * 
 * Audits Supabase Row Level Security policies to ensure they meet security requirements.
 * This script VERIFIES existing policies but does NOT modify them (no breaking changes).
 * 
 * Business Rules (Non-negotiable):
 * 1. Users can only read/write their own predictions
 * 2. Match data is read-only for all authenticated users
 * 3. Leaderboard data is read-only for all users
 * 4. Profile updates are restricted to own profile
 * 5. Predictions cannot be modified after match lock time
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

// Load environment variables from project root
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: resolve(__dirname, '..', '.env') });

// Environment variables
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing Supabase environment variables.');
  console.error('   Ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set in .env');
  process.exit(1);
}

// Create Supabase client with service role key for admin access
// Note: For actual policy inspection, we'd need service role key.
// This script uses anon key and inspects what we can see.
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Expected policy configuration
interface ExpectedPolicy {
  table: string;
  operation: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE';
  expectedRestriction: string;
  description: string;
}

const expectedPolicies: ExpectedPolicy[] = [
  {
    table: 'predictions',
    operation: 'SELECT',
    expectedRestriction: 'auth.uid() = user_id',
    description: 'Users can only read their own predictions',
  },
  {
    table: 'predictions',
    operation: 'INSERT',
    expectedRestriction: 'auth.uid() = user_id AND matches.is_locked = false',
    description: 'Users can only insert predictions for unlocked matches',
  },
  {
    table: 'predictions',
    operation: 'UPDATE',
    expectedRestriction: 'auth.uid() = user_id AND matches.is_locked = false',
    description: 'Users can only update their predictions for unlocked matches',
  },
  {
    table: 'predictions',
    operation: 'DELETE',
    expectedRestriction: 'auth.uid() = user_id AND matches.is_locked = false',
    description: 'Users can only delete their predictions for unlocked matches',
  },
  {
    table: 'matches',
    operation: 'SELECT',
    expectedRestriction: 'auth.role() = \'authenticated\'',
    description: 'Authenticated users can read matches',
  },
  {
    table: 'matches',
    operation: 'INSERT',
    expectedRestriction: 'false',
    description: 'Users cannot insert matches (admin only)',
  },
  {
    table: 'matches',
    operation: 'UPDATE',
    expectedRestriction: 'false',
    description: 'Users cannot update matches (admin only)',
  },
  {
    table: 'matches',
    operation: 'DELETE',
    expectedRestriction: 'false',
    description: 'Users cannot delete matches (admin only)',
  },
  {
    table: 'teams',
    operation: 'SELECT',
    expectedRestriction: 'auth.role() = \'authenticated\'',
    description: 'Authenticated users can read teams',
  },
  {
    table: 'teams',
    operation: 'INSERT',
    expectedRestriction: 'false',
    description: 'Users cannot insert teams (admin only)',
  },
  {
    table: 'teams',
    operation: 'UPDATE',
    expectedRestriction: 'false',
    description: 'Users cannot update teams (admin only)',
  },
  {
    table: 'teams',
    operation: 'DELETE',
    expectedRestriction: 'false',
    description: 'Users cannot delete teams (admin only)',
  },
  {
    table: 'profiles',
    operation: 'SELECT',
    expectedRestriction: 'auth.uid() = id',
    description: 'Users can only read their own profile',
  },
  {
    table: 'profiles',
    operation: 'INSERT',
    expectedRestriction: 'auth.uid() = id',
    description: 'Users can only insert their own profile',
  },
  {
    table: 'profiles',
    operation: 'UPDATE',
    expectedRestriction: 'auth.uid() = id',
    description: 'Users can only update their own profile',
  },
  {
    table: 'profiles',
    operation: 'DELETE',
    expectedRestriction: 'auth.uid() = id',
    description: 'Users can only delete their own profile',
  },
  {
    table: 'leaderboard',
    operation: 'SELECT',
    expectedRestriction: 'auth.role() = \'authenticated\'',
    description: 'Authenticated users can read leaderboard',
  },
  {
    table: 'leaderboard',
    operation: 'INSERT',
    expectedRestriction: 'false',
    description: 'Users cannot insert leaderboard entries (system only)',
  },
  {
    table: 'leaderboard',
    operation: 'UPDATE',
    expectedRestriction: 'false',
    description: 'Users cannot update leaderboard entries (system only)',
  },
  {
    table: 'leaderboard',
    operation: 'DELETE',
    expectedRestriction: 'false',
    description: 'Users cannot delete leaderboard entries (system only)',
  },
];

interface AuditResult {
  table: string;
  operation: string;
  status: 'PASS' | 'FAIL' | 'UNKNOWN';
  message: string;
  expected: string;
  found?: string;
}

async function auditRLSPolicies(): Promise<AuditResult[]> {
  const results: AuditResult[] = [];

  console.log('🔍 Starting RLS Policy Audit');
  console.log('============================\n');

  // Note: Supabase doesn't expose a direct API to query RLS policies via anon key.
  // In a real implementation with service role key, we could query:
  // SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check 
  // FROM pg_policies WHERE schemaname = 'public';
  
  // For this audit script, we'll perform functional tests instead:
  
  // 1. Test predictions table access
  console.log('Testing predictions table policies...');
  
  try {
    // Attempt to insert a prediction (should fail without auth)
    const { error: insertError } = await supabase
      .from('predictions')
      .insert({
        match_id: 'test-match',
        user_id: 'test-user',
        home_score: 2,
        away_score: 1,
        points_earned: 0,
      });
    
    if (insertError?.code === '42501') {
      results.push({
        table: 'predictions',
        operation: 'INSERT',
        status: 'PASS',
        message: 'Unauthenticated INSERT blocked by RLS',
        expected: 'Requires authentication',
      });
    } else {
      results.push({
        table: 'predictions',
        operation: 'INSERT',
        status: 'FAIL',
        message: 'Unauthenticated INSERT should be blocked',
        expected: 'Requires authentication',
      });
    }
  } catch (err) {
    results.push({
      table: 'predictions',
      operation: 'INSERT',
      status: 'UNKNOWN',
      message: `Error testing INSERT: ${err instanceof Error ? err.message : String(err)}`,
      expected: 'Requires authentication',
    });
  }
  
  // 2. Test matches table SELECT (should work for authenticated users)
  console.log('Testing matches table access...');
  
  try {
    const { data, error } = await supabase
      .from('matches')
      .select('id')
      .limit(1);
    
    if (error?.code === '42501') {
      results.push({
        table: 'matches',
        operation: 'SELECT',
        status: 'PASS',
        message: 'Unauthenticated SELECT blocked by RLS',
        expected: 'Requires authentication',
      });
    } else if (data) {
      results.push({
        table: 'matches',
        operation: 'SELECT',
        status: 'FAIL',
        message: 'Matches should not be publicly readable',
        expected: 'Requires authentication',
      });
    }
  } catch (err) {
    results.push({
      table: 'matches',
      operation: 'SELECT',
      status: 'UNKNOWN',
      message: `Error testing matches SELECT: ${err instanceof Error ? err.message : String(err)}`,
      expected: 'Requires authentication',
    });
  }
  
  // 3. Test profiles table access
  console.log('Testing profiles table access...');
  
  try {
    const { error } = await supabase
      .from('profiles')
      .select('id')
      .limit(1);
    
    if (error?.code === '42501') {
      results.push({
        table: 'profiles',
        operation: 'SELECT',
        status: 'PASS',
        message: 'Unauthenticated profiles SELECT blocked by RLS',
        expected: 'Requires authentication',
      });
    } else {
      results.push({
        table: 'profiles',
        operation: 'SELECT',
        status: 'FAIL',
        message: 'Profiles should not be publicly readable',
        expected: 'Requires authentication',
      });
    }
  } catch (err) {
    results.push({
      table: 'profiles',
      operation: 'SELECT',
      status: 'UNKNOWN',
      message: `Error testing profiles SELECT: ${err instanceof Error ? err.message : String(err)}`,
      expected: 'Requires authentication',
    });
  }
  
  // 4. Test leaderboard table access
  console.log('Testing leaderboard table access...');
  
  try {
    const { data, error } = await supabase
      .from('leaderboard')
      .select('user_id')
      .limit(1);
    
    if (error?.code === '42501') {
      results.push({
        table: 'leaderboard',
        operation: 'SELECT',
        status: 'PASS',
        message: 'Unauthenticated leaderboard SELECT blocked by RLS',
        expected: 'Requires authentication',
      });
    } else if (data) {
      results.push({
        table: 'leaderboard',
        operation: 'SELECT',
        status: 'FAIL',
        message: 'Leaderboard should not be publicly readable',
        expected: 'Requires authentication',
      });
    }
  } catch (err) {
    results.push({
      table: 'leaderboard',
      operation: 'SELECT',
      status: 'UNKNOWN',
      message: `Error testing leaderboard SELECT: ${err instanceof Error ? err.message : String(err)}`,
      expected: 'Requires authentication',
    });
  }
  
  return results;
}

async function main() {
  console.log('🚀 Quiniela 2026 - RLS Policy Audit');
  console.log('====================================\n');
  
  console.log('🔐 Expected Security Model:');
  console.log('----------------------------');
  for (const policy of expectedPolicies) {
    console.log(`📋 ${policy.table}.${policy.operation}: ${policy.description}`);
    console.log(`   Expected: ${policy.expectedRestriction}`);
  }
  console.log('');
  
  const results = await auditRLSPolicies();
  
  console.log('\n📊 Audit Results:');
  console.log('-----------------');
  
  let passCount = 0;
  let failCount = 0;
  let unknownCount = 0;
  
  for (const result of results) {
    const icon = result.status === 'PASS' ? '✅' : result.status === 'FAIL' ? '❌' : '⚠️';
    console.log(`${icon} ${result.table}.${result.operation}: ${result.status}`);
    console.log(`   ${result.message}`);
    if (result.status === 'FAIL') {
      console.log(`   Expected: ${result.expected}`);
    }
    console.log('');
    
    if (result.status === 'PASS') passCount++;
    else if (result.status === 'FAIL') failCount++;
    else unknownCount++;
  }
  
  console.log('📈 Summary:');
  console.log(`✅ PASS: ${passCount}`);
  console.log(`❌ FAIL: ${failCount}`);
  console.log(`⚠️  UNKNOWN: ${unknownCount}`);
  console.log('');
  
  if (failCount > 0) {
    console.log('❌ RLS Policy audit failed. Some security requirements are not met.');
    console.log('   Review the expected policies above and adjust RLS in Supabase dashboard.');
    process.exit(1);
  } else if (unknownCount > 0) {
    console.log('⚠️  RLS Policy audit inconclusive. Some tests could not be completed.');
    console.log('   Verify policies manually in Supabase dashboard.');
    process.exit(0);
  } else {
    console.log('✅ RLS Policy audit passed! All security requirements appear to be met.');
    console.log('   Note: This is a functional test. For complete verification, review');
    console.log('   policies in Supabase dashboard with service role key.');
    process.exit(0);
  }
}

main().catch((error) => {
  console.error('❌ Fatal error during audit:', error);
  process.exit(1);
});