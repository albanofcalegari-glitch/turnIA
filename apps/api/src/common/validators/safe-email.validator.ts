import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator'

const SUSPICIOUS_RE = /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|ALTER|CREATE|EXEC)\b|--|;|'|"|1\s*=\s*1|OR\s+1)/i

@ValidatorConstraint({ async: false })
class IsSafeEmailConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    if (typeof value !== 'string') return false
    return !SUSPICIOUS_RE.test(value)
  }

  defaultMessage(): string {
    return 'El email contiene caracteres o patrones no permitidos.'
  }
}

export function IsSafeEmail(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsSafeEmailConstraint,
    })
  }
}
