import { types, type CustomTypesConfig } from 'pg';

// SQL DATE is a calendar date, not a midnight instant in the server's timezone.
// Preserve it for supplier deadlines and customer ETAs. Timestamp parsers stay intact.
export const postgresTypes: CustomTypesConfig = {
  getTypeParser: (oid, format = 'text') =>
    oid === types.builtins.DATE && format === 'text'
      ? (value: string) => value
      : types.getTypeParser(oid, format),
};
