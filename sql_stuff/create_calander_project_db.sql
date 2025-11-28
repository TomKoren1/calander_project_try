-- 1. Create the Database
CREATE DATABASE IF NOT EXISTS calander_project_try1 CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Use the newly created database
USE calander_project_try1;

------------------------------------------------------------------------------------
-- 2. Create Tables
------------------------------------------------------------------------------------

-- Table: users
CREATE TABLE users (
    id CHAR(36) PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(255),
    profile_picture_url VARCHAR(255),
    timezone VARCHAR(50),
    locale VARCHAR(10),
    email_verified BOOLEAN DEFAULT FALSE,
    is_premium BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at DATETIME
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Table: user_auth_providers
CREATE TABLE user_auth_providers (
    id CHAR(36) PRIMARY KEY,
    user_id CHAR(36) NOT NULL,
    provider VARCHAR(50) NOT NULL,
    provider_user_id VARCHAR(255),
    access_token TEXT,
    refresh_token TEXT,
    expires_at DATETIME,
    scope TEXT,
    token_type VARCHAR(50),
    id_token TEXT,
    connected_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_used_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Table: calendars
CREATE TABLE calendars (
    id CHAR(36) PRIMARY KEY,
    user_id CHAR(36) NOT NULL,
    name VARCHAR(255),
    color VARCHAR(7),
    timezone VARCHAR(50),
    is_default BOOLEAN DEFAULT FALSE,
    is_shared BOOLEAN DEFAULT FALSE,
    shared_with JSON, -- MySQL JSON for UUID[]
    source VARCHAR(50),
    external_calendar_id VARCHAR(255),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at DATETIME,
    FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Table: events
CREATE TABLE events (
    id CHAR(36) PRIMARY KEY,
    calendar_id CHAR(36),
    user_id CHAR(36) NOT NULL,
    title VARCHAR(255),
    description TEXT,
    location VARCHAR(255),
    start_time DATETIME NOT NULL,
    end_time DATETIME NOT NULL,
    timezone VARCHAR(50),
    all_day BOOLEAN DEFAULT FALSE,
    recurrence_rule TEXT,
    recurrence_exceptions JSON, -- MySQL JSON for TIMESTAMP[]
    attendees JSON, -- MySQL JSON for array of objects
    organizer_email VARCHAR(255),
    priority INTEGER, -- Added for AI logic
    status VARCHAR(50),
    transparency VARCHAR(50),
    visibility VARCHAR(50),
    reminders JSON, -- MySQL JSON for array of objects
    conference_link VARCHAR(255),
    color VARCHAR(7),
    source VARCHAR(50),
    external_event_id VARCHAR(255),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at DATETIME,
    FOREIGN KEY (calendar_id) REFERENCES calendars(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Table: external_calendars
CREATE TABLE external_calendars (
    id CHAR(36) PRIMARY KEY,
    user_id CHAR(36) NOT NULL,
    auth_provider_id CHAR(36),
    provider_calendar_id VARCHAR(255) NOT NULL,
    internal_calendar_id CHAR(36),
    summary VARCHAR(255),
    description TEXT,
    color VARCHAR(7),
    is_primary BOOLEAN,
    sync_token VARCHAR(255),
    last_synced_at DATETIME,
    status VARCHAR(50),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_external_calendar (auth_provider_id, provider_calendar_id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (auth_provider_id) REFERENCES user_auth_providers(id),
    FOREIGN KEY (internal_calendar_id) REFERENCES calendars(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Table: external_event_map
CREATE TABLE external_event_map (
    id CHAR(36) PRIMARY KEY,
    user_id CHAR(36),
    auth_provider_id CHAR(36),
    internal_event_id CHAR(36) NOT NULL,
    provider_event_id VARCHAR(255) NOT NULL,
    provider_calendar_id VARCHAR(255) NOT NULL,
    status VARCHAR(50),
    last_synced_at DATETIME,
    UNIQUE KEY uk_external_event (auth_provider_id, provider_event_id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (auth_provider_id) REFERENCES user_auth_providers(id),
    FOREIGN KEY (internal_event_id) REFERENCES events(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Table: task_lists
CREATE TABLE task_lists (
    id CHAR(36) PRIMARY KEY,
    user_id CHAR(36) NOT NULL,
    name VARCHAR(255),
    color VARCHAR(7),
    is_default BOOLEAN DEFAULT FALSE,
    position INTEGER,
    is_shared BOOLEAN DEFAULT FALSE,
    shared_with JSON, -- MySQL JSON for UUID[]
    source VARCHAR(50),
    external_list_id VARCHAR(255),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at DATETIME,
    FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Table: tasks
CREATE TABLE tasks (
    id CHAR(36) PRIMARY KEY,
    user_id CHAR(36) NOT NULL,
    list_id CHAR(36),
    title VARCHAR(255),
    description TEXT,
    status VARCHAR(50),
    due_date DATE,
    due_datetime DATETIME,
    start_date DATE,
    start_datetime DATETIME,
    completed_at DATETIME,
    priority INTEGER,
    recurrence_rule TEXT,
    recurrence_exceptions JSON, -- MySQL JSON for TIMESTAMP[]
    reminders JSON, -- MySQL JSON for array of objects
    location VARCHAR(255),
    url VARCHAR(255),
    notes TEXT,
    tags JSON, -- MySQL JSON for UUID[]
    is_flagged BOOLEAN DEFAULT FALSE,
    position INTEGER,
    source VARCHAR(50),
    external_task_id VARCHAR(255),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at DATETIME,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (list_id) REFERENCES task_lists(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Table: external_task_lists
CREATE TABLE external_task_lists (
    id CHAR(36) PRIMARY KEY,
    user_id CHAR(36),
    auth_provider_id CHAR(36),
    provider_list_id VARCHAR(255) NOT NULL,
    name VARCHAR(255),
    is_default BOOLEAN,
    sync_token VARCHAR(255),
    last_synced_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_external_task_list (auth_provider_id, provider_list_id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (auth_provider_id) REFERENCES user_auth_providers(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Table: external_task_map
CREATE TABLE external_task_map (
    id CHAR(36) PRIMARY KEY,
    user_id CHAR(36),
    auth_provider_id CHAR(36),
    internal_task_id CHAR(36) NOT NULL,
    provider_task_id VARCHAR(255) NOT NULL,
    provider_list_id VARCHAR(255) NOT NULL,
    source VARCHAR(50),
    status VARCHAR(50),
    last_synced_at DATETIME,
    UNIQUE KEY uk_external_task (auth_provider_id, provider_task_id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (auth_provider_id) REFERENCES user_auth_providers(id),
    FOREIGN KEY (internal_task_id) REFERENCES tasks(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Table: goals
CREATE TABLE goals (
    id CHAR(36) PRIMARY KEY,
    user_id CHAR(36) NOT NULL,
    title VARCHAR(255),
    description TEXT,
    start_date DATE,
    end_date DATE,
    status VARCHAR(50),
    priority VARCHAR(50),
    progress_type VARCHAR(50),
    current_progress INTEGER DEFAULT 0, -- Added for AI tracking
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at DATETIME,
    FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Table: goal_links (Polymorphic link using application logic)
CREATE TABLE goal_links (
    id CHAR(36) PRIMARY KEY,
    goal_id CHAR(36) NOT NULL,
    item_type VARCHAR(50) NOT NULL, -- 'event'|'task'
    item_id CHAR(36) NOT NULL, -- ID in events or tasks
    weight FLOAT, -- contribution to goal progress
    completed BOOLEAN DEFAULT FALSE,
    linked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (goal_id) REFERENCES goals(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Table: tags
CREATE TABLE tags (
    id CHAR(36) PRIMARY KEY,
    user_id CHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    color VARCHAR(7),
    is_system BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_user_tag_name (user_id, name),
    FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Table: tag_links
CREATE TABLE tag_links (
    id CHAR(36) PRIMARY KEY,
    tag_id CHAR(36) NOT NULL,
    item_type VARCHAR(50) NOT NULL, -- 'event'|'task'|'goal'
    item_id CHAR(36) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tag_id) REFERENCES tags(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Table: reminders
CREATE TABLE reminders (
    id CHAR(36) PRIMARY KEY,
    user_id CHAR(36),
    item_type VARCHAR(50) NOT NULL,
    item_id CHAR(36) NOT NULL,
    trigger_type VARCHAR(50),
    trigger_offset_minutes INTEGER,
    trigger_datetime DATETIME,
    delivery_type VARCHAR(50),
    message TEXT,
    repeat_pattern VARCHAR(50), -- << FIX: Renamed from 'repeat'
    is_enabled BOOLEAN DEFAULT TRUE,
    sent_at DATETIME,
    snoozed_until DATETIME,
    external_reminder_id VARCHAR(255),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Table: attachments
CREATE TABLE attachments (
    id CHAR(36) PRIMARY KEY,
    user_id CHAR(36),
    item_type VARCHAR(50),
    item_id CHAR(36),
    url VARCHAR(255),
    file_name VARCHAR(255),
    file_type VARCHAR(50),
    uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Table: notes
CREATE TABLE notes (
    id CHAR(36) PRIMARY KEY,
    user_id CHAR(36),
    item_type VARCHAR(50),
    item_id CHAR(36),
    content TEXT,
    created_by CHAR(36),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Table: notification_logs
CREATE TABLE notification_logs (
    id CHAR(36) PRIMARY KEY,
    user_id CHAR(36),
    item_type VARCHAR(50),
    item_id CHAR(36),
    method VARCHAR(50),
    sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(50),
    details TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Table: shared_access
CREATE TABLE shared_access (
    id CHAR(36) PRIMARY KEY,
    item_type VARCHAR(50) NOT NULL,
    item_id CHAR(36) NOT NULL,
    shared_with_user_id CHAR(36),
    role VARCHAR(50),
    granted_by CHAR(36),
    granted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME,
    FOREIGN KEY (shared_with_user_id) REFERENCES users(id),
    FOREIGN KEY (granted_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

------------------------------------------------------------------------------------
-- 3. Indexes (For Performance)
------------------------------------------------------------------------------------

CREATE INDEX idx_events_start_time ON events (start_time);
CREATE INDEX idx_events_user_id ON events (user_id);
CREATE INDEX idx_tasks_user_id ON tasks (user_id);
CREATE INDEX idx_tasks_due_datetime ON tasks (due_datetime);
CREATE INDEX idx_goal_links_goal_id ON goal_links (goal_id);
-- Compound index on item_type and item_id is good for polymorphic joins
CREATE INDEX idx_goal_links_item ON goal_links (item_type, item_id);