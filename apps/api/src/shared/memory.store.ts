import { Injectable } from '@nestjs/common';
import type { ImageTask, Message, Session, User } from '@wisadel/contracts';

export interface StoredUser extends User {
  passwordHash: string;
}

@Injectable()
export class MemoryStore {
  readonly users = new Map<string, StoredUser>();
  readonly usersByEmail = new Map<string, string>();
  readonly sessions = new Map<string, Session & { userId: string }>();
  readonly messages = new Map<string, Message[]>();
  readonly imageTasks = new Map<string, ImageTask & { userId: string; clientId: string }>();
}
