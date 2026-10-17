import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { ChangePasswordDto } from './change-password.dto';
import { ForgotPasswordDto } from './forgot-password.dto';
import { LoginDto } from './login.dto';
import { RegisterDto } from './register.dto';
import { ResetPasswordDto } from './reset-password.dto';

function parse<T extends object>(dto: new () => T, plain: object) {
  const instance = plainToInstance(dto, plain);
  return { instance, errors: validateSync(instance, { whitelist: true }).map((e) => e.property) };
}

describe('email fields', () => {
  it.each([RegisterDto, LoginDto, ForgotPasswordDto])('%p lower-cases and trims the email', (dto) => {
    const { instance, errors } = parse(dto as new () => { email?: string }, { email: '  Foo@Gmail.COM ', password: 'password123' });

    expect(errors).toEqual([]);
    expect(instance.email).toBe('foo@gmail.com');
  });
});

describe('RegisterDto', () => {
  const email = 'a@b.com';

  it('accepts a password of 72 bytes and refuses 73', () => {
    expect(parse(RegisterDto, { email, password: 'a'.repeat(72) }).errors).toEqual([]);
    expect(parse(RegisterDto, { email, password: 'a'.repeat(73) }).errors).toEqual(['password']);
  });

  it('counts bytes, not characters: 40 Khmer letters are over the limit', () => {
    expect(parse(RegisterDto, { email, password: 'ក'.repeat(40) }).errors).toEqual(['password']);
  });

  it('refuses a phone number that is not one, and accepts common formats', () => {
    expect(parse(RegisterDto, { phone: 'abc', password: 'password123' }).errors).toEqual(['phone']);
    for (const phone of ['+85512345678', '012 345 678', '855 (12) 345-678']) {
      expect(parse(RegisterDto, { phone, password: 'password123' }).errors).toEqual([]);
    }
  });
});

describe('other password fields', () => {
  it('refuses a new password over 72 bytes when it is changed or reset', () => {
    const long = 'p'.repeat(73);
    expect(parse(ChangePasswordDto, { currentPassword: 'x', newPassword: long }).errors).toEqual(['newPassword']);
    expect(parse(ResetPasswordDto, { email: 'a@b.com', otp: '123456', newPassword: long }).errors).toEqual(['newPassword']);
  });

  it('still lets an existing long password sign in (it only has to fit in a normal request)', () => {
    expect(parse(LoginDto, { email: 'a@b.com', password: 'p'.repeat(100) }).errors).toEqual([]);
    expect(parse(LoginDto, { email: 'a@b.com', password: 'p'.repeat(201) }).errors).toEqual(['password']);
  });
});
