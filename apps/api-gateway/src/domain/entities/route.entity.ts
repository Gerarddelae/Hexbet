export class Route {
  constructor(
    public readonly pathPattern: string,
    public readonly targetService: string,
    public readonly methods: string[],
    public readonly requiresAuth: boolean,
    public readonly rateLimit?: {
      windowMs: number;
      maxRequests: number;
    },
  ) {}

  matches(path: string, method: string): boolean {
    if (!this.methods.includes(method) && !this.methods.includes('*')) {
      return false;
    }

    const pattern = this.pathPattern
      .replace(/\*/g, '.*')
      .replace(/\?/g, '[^/]');

    const regex = new RegExp(`^${pattern}$`);
    return regex.test(path);
  }
}