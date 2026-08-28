import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { isAxiosError } from 'axios';
import { Send } from 'lucide-react';
import { FormField } from '@/components/common/FormField';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/common/Alert';
import { LoadingOverlay } from '@/components/common/LoadingOverlay';
import { submitContactForm } from '@/services/contactService';
import { contactSchema } from '@/utils/validation';
import type { ContactFormValues } from '@/utils/validation';

interface ContactFormProps {
  defaultSubject?: string;
  defaultMessage?: string;
}

export function ContactForm({ defaultSubject, defaultMessage }: ContactFormProps) {
  const [submitState, setSubmitState] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ContactFormValues>({
    resolver: zodResolver(contactSchema),
    defaultValues: { subject: defaultSubject, message: defaultMessage },
  });

  async function onSubmit(values: ContactFormValues) {
    setSubmitState('idle');
    try {
      await submitContactForm(values);
      setSubmitState('success');
      reset();
    } catch (error) {
      const message = isAxiosError<{ message?: string }>(error)
        ? (error.response?.data.message ?? 'Something went wrong sending your message.')
        : 'Something went wrong sending your message.';
      setErrorMessage(message);
      setSubmitState('error');
    }
  }

  return (
    <div className="relative">
      {isSubmitting && <LoadingOverlay label="Sending message" />}

      {submitState === 'success' && (
        <Alert tone="success" className="mb-6">
          Thanks — your message is in. We typically reply within one business day.
        </Alert>
      )}
      {submitState === 'error' && (
        <Alert tone="error" className="mb-6">
          {errorMessage}
        </Alert>
      )}

      <form onSubmit={(e) => void handleSubmit(onSubmit)(e)} noValidate className="flex flex-col gap-5">
        <div className="grid sm:grid-cols-2 gap-5">
          <FormField label="Name" error={errors.name?.message} {...register('name')} />
          <FormField label="Email" type="email" error={errors.email?.message} {...register('email')} />
        </div>
        <div className="grid sm:grid-cols-2 gap-5">
          <FormField label="Phone" type="tel" error={errors.phone?.message} {...register('phone')} />
          <FormField label="Subject" error={errors.subject?.message} {...register('subject')} />
        </div>
        <FormField
          as="textarea"
          label="Message"
          rows={5}
          error={errors.message?.message}
          {...register('message')}
        />
        <Button type="submit" variant="primary" size="lg" disabled={isSubmitting} icon={<Send size={16} />} className="self-start">
          {isSubmitting ? 'Sending…' : 'Send message'}
        </Button>
      </form>
    </div>
  );
}
