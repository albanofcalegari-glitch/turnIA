import Link from 'next/link'

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-white">
      <nav className="border-b px-6 py-4 flex items-center justify-between max-w-7xl mx-auto">
        <span className="text-xl font-bold text-brand-600">TurnIA</span>
        <div className="flex gap-4">
          <Link href="/login"    className="text-sm text-gray-600 hover:text-gray-900">Iniciar sesión</Link>
          <Link href="/register" className="text-sm bg-brand-600 text-white px-4 py-2 rounded-md hover:bg-brand-700">
            Registrar negocio
          </Link>
        </div>
      </nav>

      <section className="max-w-4xl mx-auto px-6 py-24 text-center">
        <h1 className="text-5xl font-bold text-gray-900 mb-6">
          Gestión de turnos <span className="text-brand-600">simple y profesional</span>
        </h1>
        <p className="text-xl text-gray-500 mb-10 max-w-2xl mx-auto">
          Para peluquerías, barberías, spas, centros de estética y más.
          Configura tu agenda, gestioná profesionales y recibí reservas online.
        </p>
        <Link
          href="/register"
          className="inline-block bg-brand-600 text-white px-8 py-3 rounded-lg text-lg font-medium hover:bg-brand-700 transition-colors"
        >
          Empezar gratis
        </Link>
      </section>
    </main>
  )
}
