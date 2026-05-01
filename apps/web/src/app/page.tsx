import Link from 'next/link'
import { Calendar, Users, Clock, Shield } from 'lucide-react'
import { LandingNav } from '@/components/ui/LandingNav'

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-white to-gray-50">
      <LandingNav />

      <section className="max-w-4xl mx-auto px-4 py-16 text-center sm:px-6 sm:py-28">
        <div className="inline-flex items-center gap-1.5 bg-brand-50 text-brand-700 text-xs font-semibold tracking-wide uppercase px-4 py-1.5 rounded-full mb-5 border border-brand-100 sm:text-sm sm:mb-7">
          <span className="h-1.5 w-1.5 rounded-full bg-brand-500 animate-pulse" />
          45 días de prueba · Sin tarjeta
        </div>
        <h1 className="text-4xl font-extrabold text-gray-900 mb-5 tracking-tight sm:text-6xl sm:mb-7">
          Gestión de turnos{' '}
          <span className="bg-gradient-to-r from-brand-600 to-brand-400 bg-clip-text text-transparent">simple y profesional</span>
        </h1>
        <p className="text-base text-gray-500 mb-10 max-w-2xl mx-auto leading-relaxed sm:text-xl sm:mb-12">
          Para peluquerías, barberías, spas, centros de estética y más.
          Configurá tu agenda, gestioná profesionales y recibí reservas online.
        </p>
        <Link
          href="/register"
          className="inline-flex items-center gap-2 bg-gradient-to-r from-brand-600 to-brand-500 text-white px-7 py-3.5 rounded-xl text-base font-semibold hover:from-brand-700 hover:to-brand-600 transition-all shadow-md hover:shadow-lg sm:px-9 sm:text-lg"
        >
          Empezá tus 45 días de prueba
        </Link>
        <p className="text-xs text-gray-400 mt-5 sm:text-sm">
          Desde $60.000/mes · Cancelás cuando quieras
        </p>
      </section>

      <section className="max-w-5xl mx-auto px-4 pb-20 sm:px-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <FeatureCard icon={<Calendar size={22} />} title="Agenda inteligente" description="Vista diaria, semanal y mensual con drag & drop." />
          <FeatureCard icon={<Users size={22} />} title="Multi-profesional" description="Cada profesional con sus servicios y horarios." />
          <FeatureCard icon={<Clock size={22} />} title="Reservas 24/7" description="Tus clientes reservan desde el celular, a cualquier hora." />
          <FeatureCard icon={<Shield size={22} />} title="Pagos con MP" description="Cobrá suscripciones automáticas con Mercado Pago." />
        </div>
      </section>

      <footer className="border-t border-gray-100 py-6 text-center">
        <p className="text-xs text-gray-400">
          Desarrollado por{' '}
          <a href="https://www.qngine.com.ar" target="_blank" rel="noopener noreferrer" className="font-semibold text-gray-500 hover:text-brand-600 transition-colors">
            Qngine
          </a>
        </p>
      </footer>
    </main>
  )
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="rounded-xl border border-gray-200/80 bg-white p-5 shadow-card transition-shadow duration-200 hover:shadow-card-hover">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
        {icon}
      </div>
      <h3 className="mt-3 text-sm font-bold text-gray-900">{title}</h3>
      <p className="mt-1 text-sm text-gray-500 leading-relaxed">{description}</p>
    </div>
  )
}
