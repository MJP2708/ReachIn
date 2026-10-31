import { notFound, redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth/session';
import { HttpError } from '@/lib/http-error';

export async function pageUser() {
  const user = await currentUser();
  if (!user) redirect('/');
  return user;
}

/** An access failure renders as "not found", which reveals nothing. */
export async function orNotFound<T>(load: Promise<T>): Promise<T> {
  try {
    return await load;
  } catch (error) {
    if (error instanceof HttpError && error.status === 404) notFound();
    throw error;
  }
}
