const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
const { v4: uuidv4 } = require('uuid');


dotenv.config();



const pool = mysql.createPool({
    host: '127.0.0.1',
    port: 3306,
    user: 'root',
    password: process.env.DB_PASSWORD,
    database: 'calander_project_try1'
});


async function getDefaultUserId() {
    try {
        const [rows] = await pool.query("SELECT id FROM users LIMIT 1");
        if (rows.length === 0) {
            console.error("❌ ERROR: No users found. Create a user first.");
            return "00000000-0000-0000-0000-000000000000";
        }
        return rows[0].id;
    } catch (error) {
        console.error("DB Error:", error);
        return null;
    }
}

async function getUserId(user_name){
    try{
        const [rows] = await pool.query(`SELECT id FROM users where name = "${user_name}" LIMIT 1`);
        if (rows.length === 0) {
            console.error("❌ ERROR: No users found.");
            return "00000000-0000-0000-0000-000000000000";
        }
        return rows[0].id;
    } catch(error){
        console.error("DB error: ",error);
        return null
    }
}

//inserts:
async function create_task({
    title, user_id, description='', status='pending', priority=1, list_id=null, 
    due_date=null, due_datetime=null, start_date=null, start_datetime=null, completed_at=null,
    recurrence_rule=null, recurrence_exceptions=null, reminders=null, location='', url='', 
    notes='', tags=null, is_flagged=false, position=0, source='local', external_task_id=null
} = {}) {

    const userId = user_id || await getDefaultUserId();
    const newId = uuidv4();
    const toJson = (data) => data ? JSON.stringify(data) : null;

    const query = `INSERT INTO tasks 
        (id, user_id, list_id, title, description, status, due_date, due_datetime, start_date, start_datetime, completed_at, priority, recurrence_rule, recurrence_exceptions, reminders, location, url, notes, tags, is_flagged, position, source, external_task_id) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

    const values = [
        newId, userId, list_id, title, description, status, due_date, due_datetime, 
        start_date, start_datetime, completed_at, priority, recurrence_rule, 
        toJson(recurrence_exceptions), toJson(reminders), location, url, notes, 
        toJson(tags), is_flagged, position, source, external_task_id
    ];

    await pool.query(query, values);
    return `Success! Task created with ID: ${newId}`;
}

async function create_event({
    title, start_time, end_time, user_id, description='', location='', calendar_id=null, timezone='UTC',
    all_day=false, recurrence_rule=null, recurrence_exceptions=null, attendees=null, organizer_email=null,
    priority=0, status='confirmed', transparency='opaque', visibility='default', reminders=null,
    conference_link=null, color=null, source='local', external_event_id=null
} = {}) {
    
    console.log(`Executing: Create Event "${title}"`);
    const userId = user_id || await getDefaultUserId();
    const newId = uuidv4();
    const toJson = (data) => data ? JSON.stringify(data) : null;

    const query = `INSERT INTO events 
        (id, calendar_id, user_id, title, description, location, start_time, end_time, timezone, all_day, recurrence_rule, recurrence_exceptions, attendees, organizer_email, priority, status, transparency, visibility, reminders, conference_link, color, source, external_event_id) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

    const values = [
        newId, calendar_id, userId, title, description, location, start_time, end_time, 
        timezone, all_day, recurrence_rule, toJson(recurrence_exceptions), toJson(attendees), 
        organizer_email, priority, status, transparency, visibility, toJson(reminders), 
        conference_link, color, source, external_event_id
    ];

    await pool.query(query, values);
    return `Success! Event created with ID: ${newId}`;
}
async function create_goal({
    title, user_id, description='', start_date=null, end_date=null, status='active', 
    priority='medium', progress_type='percentage', current_progress=0
} = {}) {

    const userId = user_id || await getDefaultUserId();
    const newId = uuidv4();

    const query = `INSERT INTO goals 
        (id, user_id, title, description, start_date, end_date, status, priority, progress_type, current_progress) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

    const values = [
        newId, userId, title, description, start_date, end_date, status, priority, progress_type, current_progress
    ];

    await pool.query(query, values);
    return `Success! Goal created with ID: ${newId}`;
}
async function create_user({
    email, name='', profile_picture_url=null, timezone='UTC', locale='en-US', 
    email_verified=false, is_premium=false
} = {}) {

    if (!email) throw new Error("Email is required to create a user.");
    const newId = uuidv4();

    const query = `INSERT INTO users 
        (id, email, name, profile_picture_url, timezone, locale, email_verified, is_premium) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;

    const values = [
        newId, email, name, profile_picture_url, timezone, locale, email_verified, is_premium
    ];

    await pool.query(query, values);
    return `Success! User created with ID: ${newId}`;
}
async function create_calendar({
    user_id, name, color=null, timezone='UTC', is_default=false, 
    is_shared=false, shared_with=null, source='local', external_calendar_id=null
} = {}) {
    const userId = user_id || await getDefaultUserId();
    const newId = uuidv4();
    const toJson = (d) => d ? JSON.stringify(d) : null;

    await pool.query(
        `INSERT INTO calendars (id, user_id, name, color, timezone, is_default, is_shared, shared_with, source, external_calendar_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [newId, userId, name, color, timezone, is_default, is_shared, toJson(shared_with), source, external_calendar_id]
    );
    return `Success! Calendar created: ${newId}`;
}

async function create_external_calendar({
    user_id, auth_provider_id, provider_calendar_id, internal_calendar_id=null, summary=null, 
    description=null, color=null, is_primary=false, sync_token=null, status='connected'
} = {}) {
    const userId = user_id || await getDefaultUserId();
    const newId = uuidv4();

    await pool.query(
        `INSERT INTO external_calendars (id, user_id, auth_provider_id, provider_calendar_id, internal_calendar_id, summary, description, color, is_primary, sync_token, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [newId, userId, auth_provider_id, provider_calendar_id, internal_calendar_id, summary, description, color, is_primary, sync_token, status]
    );
    return `Success! External Calendar linked: ${newId}`;
}

async function create_external_event_map({
    user_id, auth_provider_id, internal_event_id, provider_event_id, provider_calendar_id, status='synced'
} = {}) {
    const userId = user_id || await getDefaultUserId();
    const newId = uuidv4();

    await pool.query(
        `INSERT INTO external_event_map (id, user_id, auth_provider_id, internal_event_id, provider_event_id, provider_calendar_id, status) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [newId, userId, auth_provider_id, internal_event_id, provider_event_id, provider_calendar_id, status]
    );
    return `Success! Event Map created: ${newId}`;
}

async function create_auth_provider({
    user_id, provider, provider_user_id=null, access_token=null, refresh_token=null, 
    expires_at=null, scope=null, token_type='Bearer', id_token=null
} = {}) {
    const userId = user_id || await getDefaultUserId();
    const newId = uuidv4();

    await pool.query(
        `INSERT INTO user_auth_providers (id, user_id, provider, provider_user_id, access_token, refresh_token, expires_at, scope, token_type, id_token) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [newId, userId, provider, provider_user_id, access_token, refresh_token, expires_at, scope, token_type, id_token]
    );
    return `Success! Auth Provider added: ${newId}`;
}
async function create_task_list({
    user_id, name, color=null, is_default=false, position=0, is_shared=false, 
    shared_with=null, source='local', external_list_id=null
} = {}) {
    const userId = user_id || await getDefaultUserId();
    const newId = uuidv4();
    const toJson = (d) => d ? JSON.stringify(d) : null;

    await pool.query(
        `INSERT INTO task_lists (id, user_id, name, color, is_default, position, is_shared, shared_with, source, external_list_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [newId, userId, name, color, is_default, position, is_shared, toJson(shared_with), source, external_list_id]
    );
    return `Success! Task List created: ${newId}`;
}

async function create_external_task_list({
    user_id, auth_provider_id, provider_list_id, name=null, is_default=false, sync_token=null
} = {}) {
    const userId = user_id || await getDefaultUserId();
    const newId = uuidv4();

    await pool.query(
        `INSERT INTO external_task_lists (id, user_id, auth_provider_id, provider_list_id, name, is_default, sync_token) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [newId, userId, auth_provider_id, provider_list_id, name, is_default, sync_token]
    );
    return `Success! External Task List linked: ${newId}`;
}

async function create_external_task_map({
    user_id, auth_provider_id, internal_task_id, provider_task_id, provider_list_id, source='external', status='synced'
} = {}) {
    const userId = user_id || await getDefaultUserId();
    const newId = uuidv4();

    await pool.query(
        `INSERT INTO external_task_map (id, user_id, auth_provider_id, internal_task_id, provider_task_id, provider_list_id, source, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [newId, userId, auth_provider_id, internal_task_id, provider_task_id, provider_list_id, source, status]
    );
    return `Success! Task Map created: ${newId}`;
}
async function create_goal_link({ goal_id, item_type, item_id, weight=1.0, completed=false } = {}) {
    const newId = uuidv4();
    await pool.query(
        `INSERT INTO goal_links (id, goal_id, item_type, item_id, weight, completed) VALUES (?, ?, ?, ?, ?, ?)`,
        [newId, goal_id, item_type, item_id, weight, completed]
    );
    return `Success! Goal Link created: ${newId}`;
}

async function create_tag({ user_id, name, description='', color=null, is_system=false } = {}) {
    const userId = user_id || await getDefaultUserId();
    const newId = uuidv4();

    await pool.query(
        `INSERT INTO tags (id, user_id, name, description, color, is_system) VALUES (?, ?, ?, ?, ?, ?)`,
        [newId, userId, name, description, color, is_system]
    );
    return `Success! Tag created: ${newId}`;
}

async function create_tag_link({ tag_id, item_type, item_id } = {}) {
    const newId = uuidv4();
    await pool.query(
        `INSERT INTO tag_links (id, tag_id, item_type, item_id) VALUES (?, ?, ?, ?)`,
        [newId, tag_id, item_type, item_id]
    );
    return `Success! Tag Link created: ${newId}`;
}
async function create_reminder({
    user_id, item_type, item_id, trigger_type='time', trigger_offset_minutes=null, 
    trigger_datetime=null, delivery_type='popup', message='', repeat_pattern=null, 
    is_enabled=true, external_reminder_id=null
} = {}) {
    const userId = user_id || await getDefaultUserId();
    const newId = uuidv4();

    await pool.query(
        `INSERT INTO reminders (id, user_id, item_type, item_id, trigger_type, trigger_offset_minutes, trigger_datetime, delivery_type, message, repeat_pattern, is_enabled, external_reminder_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [newId, userId, item_type, item_id, trigger_type, trigger_offset_minutes, trigger_datetime, delivery_type, message, repeat_pattern, is_enabled, external_reminder_id]
    );
    return `Success! Reminder created: ${newId}`;
}

async function create_attachment({ user_id, item_type, item_id, url, file_name, file_type } = {}) {
    const userId = user_id || await getDefaultUserId();
    const newId = uuidv4();

    await pool.query(
        `INSERT INTO attachments (id, user_id, item_type, item_id, url, file_name, file_type) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [newId, userId, item_type, item_id, url, file_name, file_type]
    );
    return `Success! Attachment created: ${newId}`;
}

async function create_note({ user_id, item_type, item_id, content, created_by } = {}) {
    const userId = user_id || await getDefaultUserId();
    const creatorId = created_by || userId;
    const newId = uuidv4();

    await pool.query(
        `INSERT INTO notes (id, user_id, item_type, item_id, content, created_by) VALUES (?, ?, ?, ?, ?, ?)`,
        [newId, userId, item_type, item_id, content, creatorId]
    );
    return `Success! Note created: ${newId}`;
}

async function create_notification_log({ user_id, item_type, item_id, method, status, details='' } = {}) {
    const userId = user_id || await getDefaultUserId();
    const newId = uuidv4();

    await pool.query(
        `INSERT INTO notification_logs (id, user_id, item_type, item_id, method, status, details) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [newId, userId, item_type, item_id, method, status, details]
    );
    return `Success! Log created: ${newId}`;
}

async function create_shared_access({ 
    item_type, item_id, shared_with_user_id, role='viewer', granted_by, expires_at=null 
} = {}) {
    const newId = uuidv4();

    await pool.query(
        `INSERT INTO shared_access (id, item_type, item_id, shared_with_user_id, role, granted_by, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [newId, item_type, item_id, shared_with_user_id, role, granted_by, expires_at]
    );
    return `Success! Access granted: ${newId}`;
}










create_shared_access({
    item_type: "calendar",
    item_id: "c2e4g6h8-0i2j-4k6l-8m0n-2o4p6q8r0s2t",
    shared_with_user_id: "b3f4e912-70c1-4b8a-9e50-3d1f0a8c4e6b",
    role: "editor" // 'viewer' or 'editor'
});

