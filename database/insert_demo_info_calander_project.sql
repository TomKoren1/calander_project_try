-- Setting a standard reference time for the demo: Oct 15, 2025
SET @ALICE_ID = 'a1c0d54a-58b2-4d13-a4c6-8f2c6e7a2b0c';
SET @BOB_ID = 'b3f4e912-70c1-4b8a-9e50-3d1f0a8c4e6b';
SET @AUTH_ALICE_GOOGLE_ID = 'a2b3c4d5-e6f7-890a-1234-567890abcdef';
SET @C_DEFAULT_ID = 'c1d2e3f4-5a6b-7c8d-9e0f-112233445566';
SET @C_TRAINING_ID = 'c2e4g6h8-0i2j-4k6l-8m0n-2o4p6q8r0s2t';
SET @TL_DEFAULT_ID = 't1s2r3q4-p5o6-n7m8-l9k0-j1i2h3g4f5e6';
SET @G_MARATHON_ID = 'g1o2a3l4-b5c6-d7e8-f90a-1b2c3d4e5f6g';
SET @E_WORK_ID = 'e1v2e3n4-t567-8901-2345-67890abcdeff';
SET @E_LONG_RUN_ID = 'e2v4e6n8-t012-3456-7890-abcdef012345';
SET @E_SPEED_ID = 'e3v6e9n2-t481-3692-5814-725036194759';
SET @T_SHOES_ID = 't1a2s3k4-5678-9012-3456-7890abcdef00';

-- ------------------------------------------------------------------
-- 1. users
-- ------------------------------------------------------------------
INSERT INTO users (id, email, name, timezone, locale, email_verified, is_premium) VALUES
(@ALICE_ID, 'alice.smith@example.com', 'Alice Smith', 'America/New_York', 'en-US', TRUE, TRUE),
(@BOB_ID, 'bob.jones@example.com', 'Bob Jones', 'Europe/London', 'en-GB', FALSE, FALSE);

-- ------------------------------------------------------------------
-- 2. user_auth_providers (Alice connected her Google account)
-- ------------------------------------------------------------------
INSERT INTO user_auth_providers (id, user_id, provider, provider_user_id, access_token, refresh_token, expires_at, scope) VALUES
(@AUTH_ALICE_GOOGLE_ID, @ALICE_ID, 'google', '101122334455667788990', 'mock_access_token_abc123', 'mock_refresh_token_xyz987', DATE_ADD(CURRENT_TIMESTAMP(), INTERVAL 1 HOUR), 'calendar,tasks');

-- ------------------------------------------------------------------
-- 3. calendars (Alice has a default local calendar and a local training calendar)
-- ------------------------------------------------------------------
INSERT INTO calendars (id, user_id, name, color, timezone, is_default, source, external_calendar_id) VALUES
(@C_DEFAULT_ID, @ALICE_ID, 'Personal', '#3F51B5', 'America/New_York', TRUE, 'local', NULL),
(@C_TRAINING_ID, @ALICE_ID, 'Marathon Training', '#009688', 'America/New_York', FALSE, 'local', NULL);

-- ------------------------------------------------------------------
-- 4. task_lists (Alice's default task list)
-- ------------------------------------------------------------------
INSERT INTO task_lists (id, user_id, name, is_default, position, source) VALUES
(@TL_DEFAULT_ID, @ALICE_ID, 'My Tasks', TRUE, 1, 'local');

-- ------------------------------------------------------------------
-- 5. goals (Alice's Half Marathon Goal, 8 weeks long)
-- ------------------------------------------------------------------
INSERT INTO goals (id, user_id, title, description, start_date, end_date, status, priority, progress_type, current_progress) VALUES
(@G_MARATHON_ID, @ALICE_ID, 'City Half Marathon Training', 'Train for 13.1 miles on Dec 15th.', '2025-10-15', '2025-12-15', 'active', 'high', 'auto', 10);

-- ------------------------------------------------------------------
-- 6. events
-- Scenario: Alice has a high-priority work event, and the AI scheduled two training runs.
-- ------------------------------------------------------------------
INSERT INTO events (
    id, calendar_id, user_id, title, description, location, start_time, end_time, timezone, all_day, priority, status, transparency, visibility, source, external_event_id
) VALUES
(@E_WORK_ID, @C_DEFAULT_ID, @ALICE_ID, 'Q4 Project Review Meeting', 'Prepare presentation for leadership team.', 'Conference Room B', '2025-10-22 10:00:00', '2025-10-22 11:30:00', 'America/New_York', FALSE, 1, 'confirmed', 'opaque', 'default', 'google', 'google-event-12345'),
(@E_LONG_RUN_ID, @C_TRAINING_ID, @ALICE_ID, 'Marathon Training: Long Run 15K', 'Target pace 6:00/km.', 'Riverside Park', '2025-10-20 06:00:00', '2025-10-20 07:30:00', 'America/New_York', FALSE, 3, 'confirmed', 'opaque', 'private', 'local', NULL),
(@E_SPEED_ID, @C_TRAINING_ID, @ALICE_ID, 'Marathon Training: Speed Drills', 'Track intervals (400m x 8).', 'Local Track', '2025-10-22 06:30:00', '2025-10-22 07:00:00', 'America/New_York', FALSE, 5, 'tentative', 'transparent', 'private', 'local', NULL);


-- ------------------------------------------------------------------
-- 7. tasks
-- ------------------------------------------------------------------
INSERT INTO tasks (id, user_id, list_id, title, description, status, due_date, priority, source) VALUES
(@T_SHOES_ID, @ALICE_ID, @TL_DEFAULT_ID, 'Research new running shoes', 'Need stability shoes for half marathon distance.', 'needsAction', '2025-10-25', 2, 'local');

-- ------------------------------------------------------------------
-- 8. goal_links (Linking Events and Tasks to the Marathon Goal)
-- ------------------------------------------------------------------
INSERT INTO goal_links (id, goal_id, item_type, item_id, weight, completed) VALUES
('gl-1111-event-work', @G_MARATHON_ID, 'event', @E_LONG_RUN_ID, 20.0, FALSE),  -- 20% contribution
('gl-2222-event-speed', @G_MARATHON_ID, 'event', @E_SPEED_ID, 5.0, TRUE),   -- 5% contribution (simulating completion)
('gl-3333-task-shoes', @G_MARATHON_ID, 'task', @T_SHOES_ID, 1.0, FALSE);   -- 1% contribution

-- ------------------------------------------------------------------
-- 9. external_event_map (Mapping the Work Event as Synced from Google)
-- ------------------------------------------------------------------
INSERT INTO external_event_map (id, user_id, auth_provider_id, internal_event_id, provider_event_id, provider_calendar_id, status, last_synced_at) VALUES
('ee-map-12345', @ALICE_ID, @AUTH_ALICE_GOOGLE_ID, @E_WORK_ID, 'google-event-12345', 'alice-primary-calendar', 'synced', CURRENT_TIMESTAMP());