import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://cybzsefzvkqanwkwghqs.supabase.co'
const SUPABASE_KEY = 'sb_publishable_a_cAz3Zrlsr0EMJH9Wr_zQ_tZYKJn8w'

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)