-- Autorise l'audio dans le bucket 'documents' pour le récit vocal (transcription).
-- Les types audio s'ajoutent aux types déjà permis (pièces). Le dépôt de pièces
-- côté app garde sa propre allowlist (sans audio) : seul le pipeline voix dépose
-- de l'audio, au chemin org/voice/.
update storage.buckets
set allowed_mime_types = (
  select array(
    select distinct unnest(
      coalesce(allowed_mime_types, array[]::text[])
      || array['audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/ogg', 'audio/wav', 'audio/x-m4a']
    )
  )
)
where id = 'documents';
