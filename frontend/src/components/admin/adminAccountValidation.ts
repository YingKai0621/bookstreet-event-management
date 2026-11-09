import { ApiError } from '../../services/apiClient';

/**
 * Account input rules from BR-64 and the Sprint 11 API contract, with messages written for the person
 * filling the form. The backend enforces the same limits; these checks only explain them earlier.
 */
export type AccountField = 'username' | 'fullName' | 'password' | 'confirmPassword' | 'email' | 'phone';
export type AccountFieldErrors = Partial<Record<AccountField, string>>;

const MAX_PASSWORD_BYTES = 72;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// No Business Rule fixes a phone format, so this only rules out letters and other symbols.
const PHONE_PATTERN = /^\+?[0-9 .()-]+$/;

const length = (value: string) => Array.from(value).length;

export function normalizeFullName(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

export function usernameError(value: string): string {
  const username = value.trim();
  if (!username) return 'Vui lòng nhập tên đăng nhập.';
  if (/\s/.test(username)) return 'Tên đăng nhập không được chứa khoảng trắng.';
  if (!/^[A-Za-z0-9]+$/.test(username)) {
    return 'Tên đăng nhập chỉ gồm chữ cái không dấu (a–z) và chữ số, không có ký tự đặc biệt.';
  }
  if (!/^[A-Za-z]/.test(username)) return 'Tên đăng nhập phải bắt đầu bằng một chữ cái.';
  if (username.length < 3 || username.length > 20) return 'Tên đăng nhập cần có từ 3 đến 20 ký tự.';
  return '';
}

export function fullNameError(value: string): string {
  const fullName = normalizeFullName(value);
  if (!fullName) return 'Vui lòng nhập họ và tên.';
  if (length(fullName) < 2) return 'Họ và tên cần có ít nhất 2 ký tự.';
  if (length(fullName) > 50) return 'Họ và tên tối đa 50 ký tự.';
  return '';
}

export function passwordError(value: string): string {
  if (!value) return 'Vui lòng nhập mật khẩu.';
  if (length(value) < 8) return 'Mật khẩu cần có ít nhất 8 ký tự.';
  if (length(value) > 64) return 'Mật khẩu tối đa 64 ký tự.';
  // BR-64 also caps the password at 72 bytes for BCrypt; only long passwords with many accented
  // characters reach it, so the message names what the person can change.
  if (new TextEncoder().encode(value).length > MAX_PASSWORD_BYTES) {
    return 'Mật khẩu có quá nhiều ký tự có dấu. Hãy rút ngắn hoặc dùng ký tự không dấu.';
  }
  return '';
}

export function confirmPasswordError(password: string, confirmation: string): string {
  if (!confirmation) return 'Vui lòng nhập lại mật khẩu.';
  if (password !== confirmation) return 'Mật khẩu xác nhận không khớp.';
  return '';
}

/** Email is optional on create; pass required when the field cannot be left empty. */
export function emailError(value: string, required = false): string {
  const email = value.trim();
  if (!email) return required ? 'Vui lòng nhập email.' : '';
  if (email.length > 255) return 'Email tối đa 255 ký tự.';
  if (!EMAIL_PATTERN.test(email)) return 'Email chưa đúng định dạng, ví dụ: ten@example.com.';
  return '';
}

export function phoneError(value: string): string {
  const phone = value.trim();
  if (!phone) return '';
  if (phone.length > 20) return 'Số điện thoại tối đa 20 ký tự.';
  if (!PHONE_PATTERN.test(phone)) return 'Số điện thoại chỉ gồm chữ số, có thể có dấu + ở đầu.';
  return '';
}

export function withoutEmpty(errors: AccountFieldErrors): AccountFieldErrors {
  return Object.fromEntries(Object.entries(errors).filter(([, message]) => Boolean(message))) as AccountFieldErrors;
}

const SERVER_FIELD_MESSAGES: Record<AccountField, string> = {
  username: 'Tên đăng nhập chưa hợp lệ.',
  fullName: 'Họ và tên chưa hợp lệ.',
  password: 'Mật khẩu chưa hợp lệ.',
  confirmPassword: 'Mật khẩu xác nhận chưa hợp lệ.',
  email: 'Email chưa hợp lệ.',
  phone: 'Số điện thoại chưa hợp lệ.',
};

/** Places a server rejection on the field it belongs to, in Vietnamese rather than the server's text. */
export function serverFieldErrors(error: unknown): AccountFieldErrors {
  if (!(error instanceof ApiError)) return {};
  const errors: AccountFieldErrors = {};
  for (const field of error.fieldErrors) {
    if (field.field in SERVER_FIELD_MESSAGES) {
      errors[field.field as AccountField] = SERVER_FIELD_MESSAGES[field.field as AccountField];
    }
  }
  if (error.code === 'USERNAME_ALREADY_EXISTS') errors.username = 'Tên đăng nhập đã được sử dụng.';
  if (error.code === 'EMAIL_ALREADY_EXISTS') errors.email = 'Email đã được tài khoản khác sử dụng.';
  if (error.code === 'VERIFIED_EMAIL_LOCKED') errors.email = 'Email đã xác minh không thể thay đổi.';
  if (error.code === 'PASSWORD_CONFIRMATION_MISMATCH') errors.confirmPassword = 'Mật khẩu xác nhận không khớp.';
  return errors;
}
