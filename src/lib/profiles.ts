import { supabase } from './supabase';
import type { Profile, VerificationStatus } from './types';

export async function getProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  return data as Profile | null;
}

export async function createProfile(profile: Partial<Profile> & { id: string }): Promise<Profile> {
  const { data, error } = await supabase
    .from('profiles')
    .insert(profile)
    .select()
    .single();
  if (error) throw error;
  return data as Profile;
}

export async function updateProfile(
  userId: string,
  updates: Partial<Profile>
): Promise<Profile> {
  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId)
    .select()
    .single();
  if (error) throw error;
  return data as Profile;
}

export function isCollegeEmail(email: string): boolean {
  const lower = email.toLowerCase().trim();
  return (
    lower.endsWith('.edu') ||
    lower.endsWith('.ac.in') ||
    lower.endsWith('.edu.in') ||
    lower.includes('.edu.') ||
    /@(gmail|yahoo|outlook|hotmail)\./i.test(lower) === false && lower.split('@')[1]?.includes('.')
  );
}

export function emailDomain(email: string): string {
  return email.split('@')[1] ?? '';
}

export async function uploadVerificationImage(
  bucket: string,
  userId: string,
  file: File
): Promise<string> {
  const ext = file.name.split('.').pop() || 'jpg';
  const path = `${userId}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    cacheControl: '3600',
    upsert: true,
  });
  if (error) throw error;
  return path;
}

export async function setVerificationStatus(
  userId: string,
  status: VerificationStatus
): Promise<void> {
  await updateProfile(userId, { verification_status: status });
}
