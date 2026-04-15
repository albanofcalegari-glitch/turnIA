import Link from 'next/link'

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-white">
      <nav className="border-b px-4 py-4 flex items-center justify-between max-w-7xl mx-auto sm:px-6">
        <span className="text-xl font-bold text-brand-600">turnIT</span>
        <div className="flex items-center gap-2 sm:gap-4">
          <Link href="/login" className="text-sm text-gray-600 hover:text-gray-900">Iniciar sesión</Link>
          <Link href="/register" className="text-sm bg-brand-600 text-white px-3 py-2 rounded-md hover:bg-brand-700 sm:px-4">
            Registrar negocio
          </Link>
        </div>
      </nav>

      <section className="max-w-4xl mx-auto px-4 py-12 text-center sm:px-6 sm:py-24">
        <div className="inline-block bg-brand-50 text-brand-700 text-xs font-semibold tracking-wide uppercase px-3 py-1 rounded-full mb-4 sm:text-sm sm:mb-6">
          45 días de prueba · Sin tarjeta
        </div>
        <h1 className="text-3xl font-bold text-gray-900 mb-4 sm:text-5xl sm:mb-6">
          Gestión de turnos <span className="text-brand-600">simple y profesional</span>
        </h1>
        <p className="text-base text-gray-500 mb-8 max-w-2xl mx-auto sm:text-xl sm:mb-10">
          Para peluquerías, barberías, spas, centros de estética y más.
          Configura tu agenda, gestioná profesionales y recibí reservas online.
        </p>
        <Link
          href="/register"
          className="inline-block bg-brand-600 text-white px-6 py-3 rounded-lg text-base font-medium hover:bg-brand-700 transition-colors sm:px-8 sm:text-lg"
        >
          Empezá tus 45 días de prueba
        </Link>
        <p className="text-xs text-gray-400 mt-4 sm:text-sm">
          Luego $60/mes · Cancelás cuando quieras
        </p>
      </section>
    </main>
  )
}
