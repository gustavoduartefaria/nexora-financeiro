CREATE TABLE `auth_attempts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`fingerprint` text NOT NULL,
	`attempted_at` integer NOT NULL,
	`successful` integer NOT NULL
);
