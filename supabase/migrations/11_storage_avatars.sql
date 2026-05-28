-- Create the avatars storage bucket (public read)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  2097152,  -- 2 MB
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do nothing;

-- Authenticated users can upload to their own path (<user_id>/...)
create policy avatars_insert_own on storage.objects
  for insert with check (
    bucket_id = 'avatars'
    and auth.uid()::text = (string_to_array(name, '/'))[1]
  );

-- Public read (bucket is public, but explicit policy documents intent)
create policy avatars_select_public on storage.objects
  for select using (bucket_id = 'avatars');
