-- Correctif : cases.next_letter_kind portait un CHECK limité aux courriers
-- impayés/litige — la création d'un dossier admin_request échouait (le wizard
-- pose next_letter_kind = 'admin_gracieux'). On aligne sur letters.kind.
alter table public.cases drop constraint if exists cases_next_letter_kind_check;
alter table public.cases add constraint cases_next_letter_kind_check
  check (next_letter_kind in (
    'reminder_1', 'reminder_2', 'formal_notice', 'response',
    'admin_gracieux', 'admin_relance', 'admin_hierarchique'
  ));
