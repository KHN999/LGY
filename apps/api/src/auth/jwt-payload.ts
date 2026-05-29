export interface JwtPayload {
  /** User id. */
  sub: number;
  username: string;
  displayName: string;
  roles: string[];
}

export interface AuthenticatedUser extends JwtPayload {}
