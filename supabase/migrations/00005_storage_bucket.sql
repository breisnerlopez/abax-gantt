do $$
begin
  if not exists (select 1 from storage.buckets where id = 'attachments') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('attachments', 'attachments', false, 5242880, '{"image/*","application/pdf","application/vnd.ms-excel","application/vnd.openxmlformats-officedocument.spreadsheetml.sheet","application/msword","application/vnd.openxmlformats-officedocument.wordprocessingml.document","text/plain","text/csv","application/zip"}');
  end if;
end;
$$;
