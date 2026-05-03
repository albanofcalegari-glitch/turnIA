import Link from 'next/link'
import {
  Calendar, Smartphone, Award, UserPlus, Share2, LayoutDashboard,
  Scissors, Clock, BarChart3, Shield, ChevronRight,
} from 'lucide-react'
import { BrandLogo } from '@/components/ui/BrandLogo'

export const metadata = {
  title: '¿Qué es Turnit? — Sistema de turnos online',
  description: 'Turnit es la plataforma para que tus clientes reserven turnos online 24/7. Agenda inteligente, fidelidad y más.',
}

const FEATURES = [
  {
    icon: Calendar,
    title: 'Agenda inteligente',
    description: 'Vista día, semana y mes. Confirmá, cancelá o completá turnos con un click. Todo en tiempo real.',
    color: 'bg-brand-100 text-brand-700',
  },
  {
    icon: Smartphone,
    title: 'Reserva online 24/7',
    description: 'Tus clientes eligen servicio, profesional, día y horario desde su celular. Sin llamadas, sin WhatsApp.',
    color: 'bg-blue-100 text-blue-700',
  },
  {
    icon: Award,
    title: 'Programa de fidelidad',
    description: 'Recompensá automáticamente a tus clientes frecuentes. Más visitas, más beneficios.',
    color: 'bg-amber-100 text-amber-700',
  },
]

const STEPS = [
  {
    num: '1',
    title: 'Registrá tu negocio',
    description: 'Cargá tus servicios, profesionales y horarios de atención en minutos.',
    icon: UserPlus,
  },
  {
    num: '2',
    title: 'Compartí tu link',
    description: 'Cada negocio tiene su link único (ej: turnit.com.ar/tunegocio). Compartilo en redes, WhatsApp o donde quieras.',
    icon: Share2,
  },
  {
    num: '3',
    title: 'Gestioná todo desde el dashboard',
    description: 'Tus clientes reservan solos. Vos confirmás, reprogramás y controlás todo desde un solo lugar.',
    icon: LayoutDashboard,
  },
]

const MORE_FEATURES = [
  { icon: Scissors, label: 'Múltiples servicios y profesionales' },
  { icon: Clock,     label: 'Horarios configurables por día' },
  { icon: BarChart3, label: 'Estadísticas y reportes' },
  { icon: Shield,    label: 'Verificación por email (OTP)' },
]

const RUBROS = ['Peluquería', 'Barbería', 'Spa', 'Estética', 'Masajes', 'Uñas', 'Consultorios', 'y más...']

export default function QueEsTurnitPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Navbar */}
      <nav className="sticky top-0 z-30 border-b border-gray-100 bg-white/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center px-4 py-4 sm:px-6">
          <Link href="/">
            <BrandLogo size="xl" forceDark />
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-brand-50 via-white to-blue-50" />
        <div className="relative mx-auto max-w-5xl px-4 pb-16 pt-16 sm:pb-24 sm:pt-24">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700">
              <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />
              45 días de prueba gratis
            </div>
            <h1 className="text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl lg:text-6xl">
              Gestioná los turnos de tu negocio,{' '}
              <span className="bg-gradient-to-r from-brand-600 to-brand-500 bg-clip-text text-transparent">sin esfuerzo</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-gray-500 sm:text-xl">
              Turnit es la plataforma para que tus clientes reserven turnos online 24/7,
              desde cualquier dispositivo. Vos solo te ocupás de atenderlos.
            </p>
            <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <Link
                href="/register"
                className="flex items-center gap-2 rounded-xl bg-brand-600 px-6 py-3.5 text-base font-semibold text-white shadow-lg shadow-brand-600/25 transition-all hover:bg-brand-700 hover:shadow-xl hover:shadow-brand-600/30"
              >
                Probá gratis 45 días
                <ChevronRight size={18} />
              </Link>
              <Link
                href="/login"
                className="rounded-xl border border-gray-200 bg-white px-6 py-3.5 text-base font-semibold text-gray-700 transition-colors hover:bg-gray-50"
              >
                Ya tengo cuenta
              </Link>
            </div>
          </div>

          {/* Dashboard mockup */}
          <div className="mx-auto mt-12 max-w-4xl sm:mt-16">
            <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl shadow-gray-200/60">
              {/* Browser bar */}
              <div className="flex items-center gap-2 border-b border-gray-100 bg-gray-50 px-4 py-2.5">
                <div className="flex gap-1.5">
                  <div className="h-3 w-3 rounded-full bg-red-400" />
                  <div className="h-3 w-3 rounded-full bg-amber-400" />
                  <div className="h-3 w-3 rounded-full bg-green-400" />
                </div>
                <div className="mx-auto rounded-md bg-white px-4 py-1 text-xs text-gray-400 border border-gray-200">
                  turnit.com.ar/dashboard
                </div>
              </div>
              {/* Dashboard preview */}
              <div className="flex">
                {/* Sidebar */}
                <div className="hidden w-44 border-r border-gray-100 bg-gray-50/60 p-3 sm:block">
                  <div className="mb-4"><BrandLogo size="sm" forceDark /></div>
                  {['Agenda', 'Servicios', 'Profesionales', 'Horarios', 'Fidelidad', 'Estadísticas'].map((item, i) => (
                    <div key={item} className={`rounded-md px-2 py-1.5 text-[11px] font-medium mb-0.5 ${i === 0 ? 'bg-brand-50 text-brand-700' : 'text-gray-400'}`}>
                      {item}
                    </div>
                  ))}
                </div>
                {/* Content */}
                <div className="flex-1 p-4 sm:p-6">
                  <div className="mb-4 flex items-center justify-between">
                    <div className="text-sm font-bold text-gray-800">Agenda</div>
                    <div className="flex gap-1">
                      {['Día', 'Semana', 'Mes'].map((v, i) => (
                        <div key={v} className={`rounded-md px-2 py-1 text-[10px] font-medium ${i === 0 ? 'bg-brand-600 text-white' : 'text-gray-400'}`}>{v}</div>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-4 gap-2 mb-4">
                    {[
                      { l: 'Turnos', v: '12' },
                      { l: 'Confirmados', v: '8' },
                      { l: 'Pendientes', v: '3' },
                      { l: 'Completados', v: '1' },
                    ].map(c => (
                      <div key={c.l} className="rounded-lg border border-gray-100 p-2">
                        <div className="text-[9px] text-gray-400 uppercase">{c.l}</div>
                        <div className="text-lg font-bold text-gray-800">{c.v}</div>
                      </div>
                    ))}
                  </div>
                  {/* Appointment rows */}
                  <div className="space-y-1.5">
                    {[
                      { time: '09:00', name: 'María García', service: 'Corte + Color', color: '#22c55e' },
                      { time: '10:15', name: 'Juan Pérez', service: 'Corte caballero', color: '#3b82f6' },
                      { time: '11:30', name: 'Ana Rodríguez', service: 'Brushing', color: '#f59e0b' },
                    ].map(a => (
                      <div key={a.time} className="flex items-center gap-3 rounded-lg border border-gray-100 px-3 py-2">
                        <span className="text-[11px] font-bold tabular-nums text-gray-500">{a.time}</span>
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: a.color }} />
                        <span className="text-xs font-medium text-gray-700">{a.name}</span>
                        <span className="ml-auto rounded-full border px-2 py-0.5 text-[10px] text-gray-500" style={{ borderColor: `${a.color}55`, backgroundColor: `${a.color}12` }}>
                          {a.service}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="border-t border-gray-100 bg-gray-50/50 py-16 sm:py-24">
        <div className="mx-auto max-w-5xl px-4">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-2xl font-extrabold text-gray-900 sm:text-3xl">Todo lo que necesitás para gestionar turnos</h2>
            <p className="mt-3 text-gray-500">Sin instalaciones, sin complicaciones. Solo registrate y empezá.</p>
          </div>
          <div className="mt-12 grid gap-6 sm:grid-cols-3">
            {FEATURES.map(f => (
              <div key={f.title} className="rounded-2xl border border-gray-200 bg-white p-6 transition-shadow hover:shadow-lg">
                <div className={`mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl ${f.color}`}>
                  <f.icon size={22} />
                </div>
                <h3 className="text-lg font-bold text-gray-900">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-500">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-16 sm:py-24">
        <div className="mx-auto max-w-5xl px-4">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-2xl font-extrabold text-gray-900 sm:text-3xl">Empezá en 3 pasos</h2>
            <p className="mt-3 text-gray-500">En menos de 10 minutos tenés tu agenda online funcionando.</p>
          </div>
          <div className="mt-12 grid gap-8 sm:grid-cols-3">
            {STEPS.map(s => (
              <div key={s.num} className="relative text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-100 text-brand-700">
                  <s.icon size={24} />
                </div>
                <div className="absolute -top-2 left-1/2 flex h-7 w-7 -translate-x-[calc(50%-24px)] items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white shadow-md">
                  {s.num}
                </div>
                <h3 className="text-base font-bold text-gray-900">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-500">{s.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* More features */}
      <section className="border-t border-gray-100 bg-gray-50/50 py-16 sm:py-20">
        <div className="mx-auto max-w-5xl px-4">
          <h2 className="mb-8 text-center text-xl font-extrabold text-gray-900 sm:text-2xl">Y mucho más...</h2>
          <div className="mx-auto grid max-w-3xl grid-cols-2 gap-4 sm:grid-cols-4">
            {MORE_FEATURES.map(f => (
              <div key={f.label} className="flex flex-col items-center gap-2 rounded-xl border border-gray-200 bg-white p-4 text-center">
                <f.icon size={20} className="text-brand-600" />
                <span className="text-xs font-medium text-gray-700">{f.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Rubros */}
      <section className="py-16 sm:py-20">
        <div className="mx-auto max-w-5xl px-4 text-center">
          <h2 className="text-xl font-extrabold text-gray-900 sm:text-2xl">Para todo tipo de negocio</h2>
          <p className="mt-2 text-sm text-gray-500">Turnit se adapta a cualquier rubro de servicios con turnos.</p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
            {RUBROS.map(r => (
              <span key={r} className="rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm">
                {r}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="border-t border-gray-100 bg-gradient-to-br from-brand-600 to-brand-700 py-16 sm:py-20">
        <div className="mx-auto max-w-3xl px-4 text-center">
          <h2 className="text-2xl font-extrabold text-white sm:text-3xl">
            ¿Listo para simplificar tus turnos?
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-brand-100">
            Creá tu cuenta gratis, cargá tus servicios y empezá a recibir reservas hoy mismo. Sin tarjeta de crédito.
          </p>
          <Link
            href="/register"
            className="mt-8 inline-flex items-center gap-2 rounded-xl bg-white px-8 py-4 text-base font-bold text-brand-700 shadow-lg transition-all hover:shadow-xl"
          >
            Crear mi cuenta gratis
            <ChevronRight size={18} />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 bg-gray-50 py-8">
        <div className="mx-auto max-w-5xl px-4 text-center">
          <BrandLogo size="sm" forceDark />
          <p className="mt-1 text-xs text-gray-400">Sistema de turnos online &copy; {new Date().getFullYear()}</p>
          <p className="mt-2 text-xs text-gray-400">
            Desarrollado por{' '}
            <a href="https://www.qngine.com.ar" target="_blank" rel="noopener noreferrer" className="font-semibold text-gray-500 hover:text-brand-600 transition-colors">
              Qngine
            </a>
          </p>
        </div>
      </footer>
    </div>
  )
}
