import { supabase } from "@/integrations/supabase/client";

export async function checkIsAdmin(): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  
  const { data } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .eq('role', 'admin')
    .maybeSingle();
  
  return !!data;
}

export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function getCurrentProfile() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();
  
  return data;
}

export async function getCurrentSubscription() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  
  const { data } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('user_id', user.id)
    .single();
  
  return data;
}
