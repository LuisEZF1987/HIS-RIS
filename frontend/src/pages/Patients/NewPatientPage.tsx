import { useNavigate } from 'react-router-dom'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { patientsApi } from '@/api/patients'
import { ArrowLeft, Save } from 'lucide-react'
import { DateTimePicker } from '@/components/DateTimePicker'

const schema = z.object({
  first_name: z.string().min(1, 'Requerido'),
  last_name:  z.string().min(1, 'Requerido'),
  date_of_birth: z.string().optional(),
  gender:     z.enum(['M', 'F', 'O', 'U']).optional(),
  dni:        z.string().optional(),
  blood_type: z.enum(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'UNKNOWN']).optional(),
  allergies:  z.string().optional(),
  phone:      z.string().optional(),
  email:      z.string().email().optional().or(z.literal('')),
})
type FormData = z.infer<typeof schema>

function FormField({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">{label}</label>
      {children}
      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
    </div>
  )
}

const inputClass = "w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-500"
const cardClass  = "bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 p-6 space-y-4"

export default function NewPatientPage() {
  const navigate     = useNavigate()
  const queryClient  = useQueryClient()

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const mutation = useMutation({
    mutationFn: (data: FormData) => {
      const contacts = []
      if (data.phone) contacts.push({ contact_type: 'phone', value: data.phone, is_primary: true })
      if (data.email) contacts.push({ contact_type: 'email', value: data.email })
      return patientsApi.create({
        first_name:    data.first_name,
        last_name:     data.last_name,
        date_of_birth: data.date_of_birth || undefined,
        gender:        data.gender,
        dni:           data.dni || undefined,
        blood_type:    data.blood_type,
        allergies:     data.allergies || undefined,
        contacts,
      })
    },
    onSuccess: (patient) => {
      queryClient.invalidateQueries({ queryKey: ['patients'] })
      toast.success(`Paciente ${patient.full_name} registrado (MRN: ${patient.mrn})`)
      navigate(`/patients/${patient.id}`)
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || 'Error al registrar paciente')
    },
  })

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => navigate(-1)} className="text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Nuevo Paciente</h1>
          <p className="text-gray-500 dark:text-slate-400 text-sm">Registrar nuevo paciente en el sistema</p>
        </div>
      </div>

      <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-6">
        <div className={cardClass}>
          <h2 className="font-semibold text-gray-900 dark:text-white border-b border-gray-200 dark:border-slate-700 pb-2">
            Datos Personales
          </h2>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="Nombres *" error={errors.first_name?.message}>
              <input {...register('first_name')} className={inputClass} placeholder="Juan" />
            </FormField>
            <FormField label="Apellidos *" error={errors.last_name?.message}>
              <input {...register('last_name')} className={inputClass} placeholder="García López" />
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="Fecha de Nacimiento">
              <input {...register('date_of_birth')} type="date" className={inputClass} />
            </FormField>
            <FormField label="Género">
              <select {...register('gender')} className={inputClass}>
                <option value="">Seleccionar</option>
                <option value="M">Masculino</option>
                <option value="F">Femenino</option>
                <option value="O">Otro</option>
                <option value="U">No especificado</option>
              </select>
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="DNI / Cédula">
              <input {...register('dni')} className={inputClass} placeholder="12345678" />
            </FormField>
            <FormField label="Tipo de Sangre">
              <select {...register('blood_type')} className={inputClass}>
                <option value="">Desconocido</option>
                {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </FormField>
          </div>

          <FormField label="Alergias">
            <textarea {...register('allergies')} className={inputClass} rows={2} placeholder="Penicilina, ASA..." />
          </FormField>
        </div>

        <div className={cardClass}>
          <h2 className="font-semibold text-gray-900 dark:text-white border-b border-gray-200 dark:border-slate-700 pb-2">
            Contacto
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Teléfono">
              <input {...register('phone')} className={inputClass} placeholder="+593 99 123 4567" />
            </FormField>
            <FormField label="Email" error={errors.email?.message}>
              <input {...register('email')} type="email" className={inputClass} placeholder="paciente@email.com" />
            </FormField>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex-1 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-300 py-2.5 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 font-medium text-sm"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={mutation.isPending}
            className="flex-1 flex items-center justify-center gap-2 bg-primary-600 text-white py-2.5 rounded-lg hover:bg-primary-700 disabled:opacity-50 font-medium text-sm"
          >
            <Save className="w-4 h-4" />
            {mutation.isPending ? 'Guardando...' : 'Registrar Paciente'}
          </button>
        </div>
      </form>
    </div>
  )
}
