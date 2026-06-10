import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY

console.log('URL:', supabaseUrl)
console.log('Key:', supabaseKey ? supabaseKey.slice(0, 20) + '...' : 'NOT SET')

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Variables de entorno no configuradas')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function testConnection() {
  console.log('\n🔍 Probando conexión a Supabase...\n')
  
  try {
    // Test teams
    const { data: teams, error: teamsError } = await supabase
      .from('teams')
      .select('count')
      .single()
    
    if (teamsError) {
      console.error('❌ Error teams:', teamsError.message)
    } else {
      console.log('✅ Tabla teams:', teams.count, 'equipos')
    }

    // Test matches
    const { data: matches, error: matchesError } = await supabase
      .from('matches')
      .select('count')
      .single()
    
    if (matchesError) {
      console.error('❌ Error matches:', matchesError.message)
    } else {
      console.log('✅ Tabla matches:', matches.count, 'partidos')
    }

    // Sample match
    const { data: sampleMatch } = await supabase
      .from('matches')
      .select('match_number, match_date, home_team_id, away_team_id')
      .eq('match_number', 1)
      .single()
    
    if (sampleMatch) {
      console.log('\n📅 Partido 1:')
      console.log('   Fecha:', sampleMatch.match_date)
      console.log('   Local:', sampleMatch.home_team_id)
      console.log('   Visitante:', sampleMatch.away_team_id)
    }

    console.log('\n✅ Conexión exitosa!')
  } catch (err) {
    console.error('❌ Error:', err)
  }
}

testConnection()
