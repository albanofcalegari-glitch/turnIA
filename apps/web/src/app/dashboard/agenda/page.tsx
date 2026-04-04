import { redirect } from 'next/navigation'

/** The agenda lives at /dashboard (root). Redirect in case someone lands here. */
export default function AgendaPage() {
  redirect('/dashboard')
}
