import nodemailer from 'nodemailer';

const APP_URL = process.env.APP_URL || 'http://localhost:3000';

export class EmailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
    });
  }

  /**
   * Send verification email
   */
  async sendVerificationEmail(to: string, name: string, code: string): Promise<void> {
    const mailOptions = {
      from: process.env.SMTP_FROM,
      to,
      subject: 'Email Verification - Facility Reservation System',
      html: `
        <h2>Welcome ${name}!</h2>
        <p>Thank you for registering with our Facility Reservation System.</p>
        <p>Your verification code is: <strong style="font-size: 24px; color: #2563eb;">${code}</strong></p>
        <p>This code will expire in 15 minutes.</p>
        <p>If you did not request this, please ignore this email.</p>
        <hr>
        <p style="color: #666; font-size: 12px;">
          Facility Reservation System<br>
          ${APP_URL}
        </p>
      `,
    };

    try {
      await this.transporter.sendMail(mailOptions);
      console.log(`Verification email sent to ${to}`);
    } catch (error: any) {
      console.error('Failed to send verification email:', error.message);
      // In development, log the verification code
      if (process.env.NODE_ENV === 'development') {
        console.log(`[DEV] Verification code for ${to}: ${code}`);
      }
    }
  }

  /**
   * Send password reset email
   */
  async sendPasswordResetEmail(to: string, name: string, token: string): Promise<void> {
    const resetUrl = `${APP_URL}/reset-password?token=${token}`;

    const mailOptions = {
      from: process.env.SMTP_FROM,
      to,
      subject: 'Password Reset Request - Facility Reservation System',
      html: `
        <h2>Hello ${name},</h2>
        <p>You have requested to reset your password.</p>
        <p>Click the link below to reset your password:</p>
        <p><a href="${resetUrl}" style="color: #2563eb; font-weight: bold;">${resetUrl}</a></p>
        <p>This link will expire in 60 minutes.</p>
        <p>If you did not request this, please ignore this email and your password will remain unchanged.</p>
        <hr>
        <p style="color: #666; font-size: 12px;">
          Facility Reservation System<br>
          ${APP_URL}
        </p>
      `,
    };

    try {
      await this.transporter.sendMail(mailOptions);
      console.log(`Password reset email sent to ${to}`);
    } catch (error: any) {
      console.error('Failed to send password reset email:', error.message);
      // In development, log the reset URL
      if (process.env.NODE_ENV === 'development') {
        console.log(`[DEV] Password reset URL for ${to}: ${resetUrl}`);
      }
    }
  }

  /**
   * Send reservation confirmation email
   */
  async sendReservationConfirmation(
    to: string,
    name: string,
    applicationId: number,
    eventName: string,
    totalAmount: number,
    usageDetails: string
  ): Promise<void> {
    const mailOptions = {
      from: process.env.SMTP_FROM,
      to,
      subject: `Reservation Confirmation - ${eventName}`,
      html: `
        <h2>Reservation Confirmed</h2>
        <p>Dear ${name},</p>
        <p>Your facility reservation has been confirmed.</p>

        <h3>Reservation Details</h3>
        <p><strong>Reservation Number:</strong> ${applicationId}</p>
        <p><strong>Event Name:</strong> ${eventName}</p>
        <p><strong>Total Amount:</strong> ¥${totalAmount.toLocaleString()}</p>

        <h3>Usage Details</h3>
        <pre style="background: #f5f5f5; padding: 10px; border-radius: 4px;">${usageDetails}</pre>

        <p>You can view your reservation details at: <a href="${APP_URL}/my-reservations">${APP_URL}/my-reservations</a></p>

        <p>Thank you for using our facility!</p>

        <hr>
        <p style="color: #666; font-size: 12px;">
          Facility Reservation System<br>
          ${APP_URL}
        </p>
      `,
    };

    try {
      await this.transporter.sendMail(mailOptions);
      console.log(`Reservation confirmation email sent to ${to}`);
    } catch (error: any) {
      console.error('Failed to send reservation confirmation email:', error.message);
    }
  }

  /**
   * Send cancellation notification email
   */
  async sendCancellationNotification(
    to: string,
    name: string,
    applicationId: number,
    eventName: string,
    cancellationFee: number
  ): Promise<void> {
    const mailOptions = {
      from: process.env.SMTP_FROM,
      to,
      subject: `Reservation Cancelled - ${eventName}`,
      html: `
        <h2>Reservation Cancelled</h2>
        <p>Dear ${name},</p>
        <p>Your facility reservation has been cancelled.</p>

        <h3>Cancellation Details</h3>
        <p><strong>Reservation Number:</strong> ${applicationId}</p>
        <p><strong>Event Name:</strong> ${eventName}</p>
        <p><strong>Cancellation Fee:</strong> ¥${cancellationFee.toLocaleString()}</p>

        ${cancellationFee > 0 ? `<p style="color: #dc2626;">A cancellation fee of ¥${cancellationFee.toLocaleString()} has been applied.</p>` : ''}

        <p>If you have any questions, please contact us.</p>

        <hr>
        <p style="color: #666; font-size: 12px;">
          Facility Reservation System<br>
          ${APP_URL}
        </p>
      `,
    };

    try {
      await this.transporter.sendMail(mailOptions);
      console.log(`Cancellation notification email sent to ${to}`);
    } catch (error: any) {
      console.error('Failed to send cancellation notification email:', error.message);
    }
  }

  /**
   * Send admin notification for new reservation
   */
  async sendAdminNotification(
    applicationId: number,
    eventName: string,
    applicantName: string,
    totalAmount: number
  ): Promise<void> {
    const adminEmail = process.env.ADMIN_EMAIL;
    if (!adminEmail) {
      console.log('No admin email configured');
      return;
    }

    const mailOptions = {
      from: process.env.SMTP_FROM,
      to: adminEmail,
      subject: `New Reservation - ${eventName}`,
      html: `
        <h2>New Facility Reservation</h2>
        <p>A new reservation has been created.</p>

        <h3>Details</h3>
        <p><strong>Reservation Number:</strong> ${applicationId}</p>
        <p><strong>Event Name:</strong> ${eventName}</p>
        <p><strong>Applicant:</strong> ${applicantName}</p>
        <p><strong>Total Amount:</strong> ¥${totalAmount.toLocaleString()}</p>

        <p><a href="${APP_URL}/admin/applications/${applicationId}">View Reservation Details</a></p>

        <hr>
        <p style="color: #666; font-size: 12px;">
          Facility Reservation System Admin Notification
        </p>
      `,
    };

    try {
      await this.transporter.sendMail(mailOptions);
      console.log('Admin notification email sent');
    } catch (error: any) {
      console.error('Failed to send admin notification email:', error.message);
    }
  }
}

export default new EmailService();
