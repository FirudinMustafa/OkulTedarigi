import { z, ZodIssueCode } from 'zod'

const errorMap: z.ZodErrorMap = (issue, ctx) => {
  switch (issue.code) {
    case ZodIssueCode.invalid_type: {
      if (issue.received === 'undefined' || issue.received === 'null') {
        return { message: 'Bu alan zorunludur' }
      }
      return { message: 'Gecersiz deger' }
    }
    case ZodIssueCode.too_small: {
      if (issue.type === 'string') {
        return { message: `En az ${issue.minimum} karakter olmalidir` }
      }
      if (issue.type === 'array') {
        return { message: `En az ${issue.minimum} oge gerekli` }
      }
      if (issue.type === 'number') {
        return { message: `En az ${issue.minimum} olmalidir` }
      }
      return { message: 'Deger cok kucuk' }
    }
    case ZodIssueCode.too_big: {
      if (issue.type === 'string') {
        return { message: `En fazla ${issue.maximum} karakter olabilir` }
      }
      if (issue.type === 'array') {
        return { message: `En fazla ${issue.maximum} oge olabilir` }
      }
      if (issue.type === 'number') {
        return { message: `En fazla ${issue.maximum} olabilir` }
      }
      return { message: 'Deger cok buyuk' }
    }
    case ZodIssueCode.invalid_string: {
      if (issue.validation === 'email') return { message: 'Gecerli bir e-posta giriniz' }
      if (issue.validation === 'url') return { message: 'Gecerli bir URL giriniz' }
      if (issue.validation === 'uuid') return { message: 'Gecerli bir kimlik degeri giriniz' }
      return { message: 'Gecersiz format' }
    }
    case ZodIssueCode.invalid_enum_value:
      return { message: 'Gecersiz secim' }
    case ZodIssueCode.unrecognized_keys:
      return { message: 'Bilinmeyen alan(lar)' }
    case ZodIssueCode.invalid_date:
      return { message: 'Gecersiz tarih' }
    case ZodIssueCode.custom:
      return { message: ctx.defaultError }
    default:
      return { message: ctx.defaultError }
  }
}

z.setErrorMap(errorMap)
