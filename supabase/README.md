# Supabase (fase F5)

Pasta reservada para `migrations/` e `seed.sql`. Nada é usado na fase F1.

Tabelas previstas: `profiles`, `legal_areas`, `legal_cases`, `triage_questions`,
`triage_answers`, `case_documents`, `dossiers`, `case_assignments`, `case_notes`,
`case_status_history`, `audit_logs`, `contracts`, `installments`, `legal_pieces`,
`process_events`, `deadlines`.

RLS: o acesso do advogado deve ser restringido por `case_assignments`, não apenas por papel.
