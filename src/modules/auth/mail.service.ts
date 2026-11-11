import nodemailer, { type Transporter } from 'nodemailer'
import { env } from '../../config/env.js'
import { logger } from '../../config/logger.js'

export interface MailRecipient {
  name: string
  email: string
}

export interface IMailService {
  sendEmailVerification(user: MailRecipient, token: string): Promise<void>
  sendPasswordReset(user: MailRecipient, token: string): Promise<void>
}

export class LogMailService implements IMailService {
  async sendEmailVerification(user: MailRecipient, token: string): Promise<void> {
    const link = `${env.FRONTEND_URL}/verify-email?token=${encodeURIComponent(token)}`
    logger.info({ email: user.email, link }, '[MAIL LOG] Vérification de l’adresse email')
  }

  async sendPasswordReset(user: MailRecipient, token: string): Promise<void> {
    const link = `${env.FRONTEND_URL}/reset-password?token=${encodeURIComponent(token)}`
    logger.info({ email: user.email, link }, '[MAIL LOG] Réinitialisation du mot de passe')
  }
}

export class SmtpMailService implements IMailService {
  private readonly transporter: Transporter

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: env.MAIL_HOST,
      port: env.MAIL_PORT,
      secure: env.MAIL_SECURE,
      ...(env.MAIL_USER
        ? { auth: { user: env.MAIL_USER, pass: env.MAIL_PASSWORD ?? '' } }
        : {}),
    })
  }

  async sendEmailVerification(user: MailRecipient, token: string): Promise<void> {
    const link = `${env.FRONTEND_URL}/verify-email?token=${encodeURIComponent(token)}`
    await this.transporter.sendMail({
      from: env.MAIL_FROM,
      to: user.email,
      subject: 'Vérifiez votre adresse email',
      text: `Bonjour ${user.name}, vérifiez votre adresse : ${link}`,
      html: `<p>Bonjour <strong>${escapeHtml(user.name)}</strong>,</p><p><a href="${link}">Vérifier mon adresse</a></p>`,
    })
  }

  async sendPasswordReset(user: MailRecipient, token: string): Promise<void> {
    const link = `${env.FRONTEND_URL}/reset-password?token=${encodeURIComponent(token)}`
    await this.transporter.sendMail({
      from: env.MAIL_FROM,
      to: user.email,
      subject: 'Réinitialisez votre mot de passe',
      text: `Bonjour ${user.name}, réinitialisez votre mot de passe : ${link}`,
      html: `<p>Bonjour <strong>${escapeHtml(user.name)}</strong>,</p><p><a href="${link}">Réinitialiser mon mot de passe</a></p>`,
    })
  }
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    }
    return entities[character] ?? character
  })
}

export function createMailService(): IMailService {
  return env.MAIL_DRIVER === 'smtp' ? new SmtpMailService() : new LogMailService()
}
