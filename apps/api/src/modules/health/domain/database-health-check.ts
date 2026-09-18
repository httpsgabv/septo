export abstract class DatabaseHealthCheck {
  abstract isUp(): Promise<boolean>;
}
