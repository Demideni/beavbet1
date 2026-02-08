declare module 'bcryptjs' {
  export interface BcryptStatic {
    hashSync(s: string, saltOrRounds: number | string): string;
    compareSync(s: string, hash: string): boolean;
    genSaltSync(rounds?: number): string;

    hash(s: string, saltOrRounds: number | string): Promise<string>;
    compare(s: string, hash: string): Promise<boolean>;
    genSalt(rounds?: number): Promise<string>;
  }

  const bcrypt: BcryptStatic;
  export default bcrypt;
}
