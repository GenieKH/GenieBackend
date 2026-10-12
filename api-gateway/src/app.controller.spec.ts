import { AppController } from './app.controller';

describe('AppController', () => {
  it('reports the gateway as healthy', () => {
    expect(new AppController().getHealth()).toEqual({ status: 'ok' });
  });
});
