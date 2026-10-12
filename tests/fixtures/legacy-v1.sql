-- Original application schema, before Drizzle (kept independent of the current ORM schema).
CREATE TABLE accounts(id TEXT PRIMARY KEY,name TEXT NOT NULL);
CREATE TABLE drafts(id INTEGER PRIMARY KEY CHECK(id=1),body TEXT NOT NULL,images TEXT NOT NULL);
CREATE TABLE tasks(id TEXT PRIMARY KEY,body TEXT NOT NULL,images TEXT NOT NULL,createdAt TEXT NOT NULL);
CREATE TABLE targets(id TEXT PRIMARY KEY,taskId TEXT NOT NULL REFERENCES tasks(id),accountId TEXT NOT NULL REFERENCES accounts(id),identityId TEXT NOT NULL,name TEXT NOT NULL,kind TEXT NOT NULL,status TEXT NOT NULL,error TEXT,url TEXT);
CREATE TABLE attempts(id TEXT PRIMARY KEY,targetId TEXT NOT NULL REFERENCES targets(id),startedAt TEXT NOT NULL,status TEXT NOT NULL,error TEXT,url TEXT);
PRAGMA user_version=1;
