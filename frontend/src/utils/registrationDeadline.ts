export function registrationDeadlinePassed(deadline: string | null | undefined, now = Date.now()): boolean {
  return Boolean(deadline && now > Date.parse(deadline));
}
