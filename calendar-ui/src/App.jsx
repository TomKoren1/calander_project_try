import React, { useState, useEffect } from 'react';
import { 
  Calendar as CalendarIcon, RefreshCw, AlertCircle, ChevronLeft, ChevronRight, 
  Clock, CheckCircle2, Trash2, Edit2, X, Save 
} from 'lucide-react';

const API_BASE = 'http://127.0.0.1:5001/api/data';

function App() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);

  // --- Modal State ---
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  
  // --- Form State ---
  const [formData, setFormData] = useState({
    title: '',
    desc: '',
    start: '',
    end: '',
    dueDate: ''
  });

  // --- Fetch Data ---
  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [eventsRes, tasksRes] = await Promise.all([
        fetch(`${API_BASE}/events`),
        fetch(`${API_BASE}/tasks`)
      ]);

      const eventsData = await eventsRes.json();
      const tasksData = await tasksRes.json();

      if (eventsData.error) throw new Error(eventsData.error);
      if (tasksData.error) throw new Error(tasksData.error);

      const rawEvents = eventsData.rows || eventsData;
      const rawTasks = tasksData.rows || tasksData;

      const formattedEvents = rawEvents.map(evt => ({
        id: evt.id,
        type: 'event', // Maps to 'events' table
        title: evt.title,
        start: new Date(evt.start_time),
        end: new Date(evt.end_time),
        desc: evt.description,
        color: 'bg-teal-100 text-teal-800 border-teal-600',
        borderColor: 'border-teal-200'
      }));

      const formattedTasks = rawTasks.map(task => {
        const dateStr = task.due_date; 
        const dateObj = new Date(dateStr);
        const userTimezoneOffset = dateObj.getTimezoneOffset() * 60000;
        const adjustedDate = new Date(dateObj.getTime() + userTimezoneOffset);

        return {
          id: task.id,
          type: 'task', // Maps to 'tasks' table
          title: task.title,
          start: adjustedDate, 
          end: adjustedDate, 
          desc: task.description,
          status: task.status,
          color: 'bg-amber-100 text-amber-800 border-amber-600',
          borderColor: 'border-amber-200'
        };
      });

      const combined = [...formattedEvents, ...formattedTasks].sort((a, b) => a.start - b.start);
      setItems(combined);

    } catch (err) {
      console.error("Failed to fetch data:", err);
      setError("Could not load data. Is app.py running?");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // --- CRUD Operations ---

  const handleDelete = async (item) => {
    if (!confirm(`Are you sure you want to delete "${item.title}"?`)) return;

    const tableName = item.type === 'event' ? 'events' : 'tasks';
    
    try {
      const response = await fetch(`${API_BASE}/${tableName}/${item.id}`, {
        method: 'DELETE'
      });
      const result = await response.json();
      
      if (!response.ok) throw new Error(result.error);
      
      // Refresh UI
      fetchData();
    } catch (err) {
      alert(`Error deleting item: ${err.message}`);
    }
  };

  const handleEditClick = (item) => {
    setEditingItem(item);
    
    // Format dates for HTML inputs
    // For Datetime-local: YYYY-MM-DDTHH:MM
    const formatDateTime = (date) => {
      const offset = date.getTimezoneOffset() * 60000;
      const localDate = new Date(date.getTime() - offset);
      return localDate.toISOString().slice(0, 16);
    };

    // For Date only: YYYY-MM-DD
    const formatDate = (date) => {
      const offset = date.getTimezoneOffset() * 60000;
      const localDate = new Date(date.getTime() - offset);
      return localDate.toISOString().slice(0, 10);
    };

    setFormData({
      title: item.title,
      desc: item.desc || '',
      start: item.type === 'event' ? formatDateTime(item.start) : '',
      end: item.type === 'event' ? formatDateTime(item.end) : '',
      dueDate: item.type === 'task' ? formatDate(item.start) : ''
    });
    
    setIsModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!editingItem) return;

    const tableName = editingItem.type === 'event' ? 'events' : 'tasks';
    
    // Construct Payload based on type
    let payload = {
      title: formData.title,
      description: formData.desc
    };

    if (editingItem.type === 'event') {
      // MySQL expects 'YYYY-MM-DD HH:MM:SS', but HTML gives 'YYYY-MM-DDTHH:MM'
      // We replace T with space
      payload.start_time = formData.start.replace('T', ' ');
      payload.end_time = formData.end.replace('T', ' ');
    } else {
      payload.due_date = formData.dueDate;
    }

    try {
      const response = await fetch(`${API_BASE}/${tableName}/${editingItem.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const result = await response.json();

      if (!response.ok) throw new Error(result.error);

      setIsModalOpen(false);
      fetchData();
    } catch (err) {
      alert(`Error updating item: ${err.message}`);
    }
  };

  // --- Date Helpers (Same as before) ---
  const getDaysInMonth = (date) => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  const getFirstDayOfMonth = (date) => new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  const addMonths = (n) => {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() + n);
    setCurrentDate(newDate);
    setSelectedDate(null);
  };
  const isSameDay = (d1, d2) => d1.getDate() === d2.getDate() && d1.getMonth() === d2.getMonth() && d1.getFullYear() === d2.getFullYear();
  const isToday = (date) => isSameDay(date, new Date());

  // --- Render Logic ---
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const daysInMonth = getDaysInMonth(currentDate);
  const firstDay = getFirstDayOfMonth(currentDate);
  const blanks = Array(firstDay).fill(null);
  const days = Array.from({ length: daysInMonth }, (_, i) => new Date(currentDate.getFullYear(), currentDate.getMonth(), i + 1));
  const totalSlots = [...blanks, ...days];
  const getItemsForDay = (date) => {
    if (!date) return [];
    return items.filter(item => isSameDay(item.start, date));
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans text-gray-900">
      
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200 px-6 py-4 flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center space-x-3 self-start md:self-auto">
          <div className="bg-gradient-to-br from-teal-500 to-emerald-600 p-2 rounded-lg text-white shadow-md">
            <CalendarIcon size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-800 tracking-tight">Daily Planner</h1>
            <div className="flex space-x-3 text-xs font-medium text-gray-500 mt-0.5">
                <span className="flex items-center"><div className="w-2 h-2 rounded-full bg-teal-500 mr-1"></div> Events</span>
                <span className="flex items-center"><div className="w-2 h-2 rounded-full bg-amber-500 mr-1"></div> Tasks</span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center space-x-3 bg-gray-100 p-1 rounded-xl">
          <button onClick={() => addMonths(-1)} className="p-2 hover:bg-white rounded-lg transition-all shadow-sm hover:shadow text-gray-600">
            <ChevronLeft size={18} />
          </button>
          <span className="px-4 font-bold text-gray-700 w-40 text-center select-none">
            {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
          </span>
          <button onClick={() => addMonths(1)} className="p-2 hover:bg-white rounded-lg transition-all shadow-sm hover:shadow text-gray-600">
            <ChevronRight size={18} />
          </button>
        </div>

        <div className="flex space-x-3">
            <button onClick={() => { setCurrentDate(new Date()); setSelectedDate(null); }} className="px-4 py-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 text-sm font-semibold text-gray-600 shadow-sm transition-all">Today</button>
            <button onClick={fetchData} className="flex items-center space-x-2 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-all text-sm font-semibold shadow-md active:transform active:scale-95">
                <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
                <span className="hidden md:inline">Sync</span>
            </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-6 flex flex-col lg:flex-row gap-6 h-[calc(100vh-88px)] overflow-hidden">
        {error ? (
          <div className="w-full h-full flex flex-col items-center justify-center text-red-500 space-y-4 bg-white rounded-2xl shadow-sm border border-red-100">
            <div className="bg-red-50 p-4 rounded-full"><AlertCircle size={40} /></div>
            <p className="text-lg font-medium">{error}</p>
            <button onClick={fetchData} className="text-sm bg-white border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-50 shadow-sm">Try Again</button>
          </div>
        ) : (
          <>
            {/* Calendar Grid */}
            <div className="flex-1 bg-white rounded-2xl shadow-sm border border-gray-200 flex flex-col overflow-hidden">
              <div className="grid grid-cols-7 border-b border-gray-100 bg-gray-50/50">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                  <div key={day} className="py-3 text-center text-xs font-bold text-gray-400 uppercase tracking-wider">{day}</div>
                ))}
              </div>
              <div className="flex-1 grid grid-cols-7 grid-rows-6">
                {totalSlots.map((dayDate, index) => {
                  if (!dayDate) return <div key={index} className="bg-gray-50/30 border-r border-b border-gray-100"></div>;
                  const dayItems = getItemsForDay(dayDate);
                  const isSelected = selectedDate && isSameDay(dayDate, selectedDate);
                  const isCurrentDay = isToday(dayDate);
                  return (
                    <div key={index} onClick={() => setSelectedDate(dayDate)}
                      className={`border-r border-b border-gray-100 p-2 relative transition-all cursor-pointer flex flex-col gap-1 group ${isSelected ? 'bg-indigo-50 ring-inset ring-2 ring-indigo-500 z-10' : 'hover:bg-gray-50'} ${isCurrentDay ? 'bg-blue-50/30' : ''}`}
                    >
                      <div className="flex justify-between items-start mb-1">
                        <span className={`text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full transition-colors ${isCurrentDay ? 'bg-blue-600 text-white shadow-md' : 'text-gray-700 group-hover:bg-gray-200'}`}>{dayDate.getDate()}</span>
                      </div>
                      <div className="flex-1 overflow-y-auto space-y-1 scrollbar-hide">
                        {dayItems.slice(0, 4).map(item => (
                          <div key={item.id} className={`text-[10px] truncate px-1.5 py-0.5 rounded font-medium ${item.color} border-l-2 flex items-center`}>
                            {item.type === 'task' && <div className="w-1 h-1 rounded-full bg-amber-500 mr-1 shrink-0" />}
                            {item.title}
                          </div>
                        ))}
                        {dayItems.length > 4 && <div className="text-[10px] text-gray-400 pl-1 font-medium">+ {dayItems.length - 4} more</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Side Panel: Details */}
            <div className="w-full lg:w-96 bg-white rounded-2xl shadow-xl border border-gray-200 flex flex-col overflow-hidden transform transition-all">
              <div className="p-6 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
                <h2 className="text-xl font-bold text-gray-800">
                  {selectedDate ? (
                    <>{selectedDate.toLocaleDateString('en-US', { weekday: 'long' })} <span className="block text-sm font-medium text-gray-500 mt-1">{selectedDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span></>
                  ) : <span className="text-gray-400">Select a date</span>}
                </h2>
              </div>
              <div className="flex-1 p-4 overflow-y-auto bg-gray-50/50">
                {!selectedDate ? (
                  <div className="h-full flex flex-col items-center justify-center text-gray-400 text-center space-y-4">
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center"><CalendarIcon size={32} className="opacity-40" /></div>
                    <p className="text-sm font-medium">Select a date on the grid<br/>to view your schedule</p>
                  </div>
                ) : getItemsForDay(selectedDate).length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-gray-400 text-center"><p className="text-sm">No plans for this day.</p></div>
                ) : (
                  <div className="space-y-3">
                    {getItemsForDay(selectedDate).map(item => (
                      <div key={item.id} className={`group p-4 rounded-xl border ${item.borderColor} bg-white shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5`}>
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            {item.type === 'event' ? <span className="bg-teal-100 p-1.5 rounded-md text-teal-700"><Clock size={14} /></span> : <span className="bg-amber-100 p-1.5 rounded-md text-amber-700"><CheckCircle2 size={14} /></span>}
                            <h3 className="font-bold text-gray-800 text-sm leading-tight">{item.title}</h3>
                          </div>
                          {/* ⭐️ NEW: Action Buttons ⭐️ */}
                          <div className="flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => handleEditClick(item)} className="p-1.5 rounded-md hover:bg-gray-100 text-gray-500 hover:text-blue-600 transition-colors" title="Edit">
                                <Edit2 size={14} />
                            </button>
                            <button onClick={() => handleDelete(item)} className="p-1.5 rounded-md hover:bg-red-50 text-gray-500 hover:text-red-600 transition-colors" title="Delete">
                                <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                        <div className="pl-9">
                            {item.type === 'event' ? (
                                <div className="text-xs font-semibold text-gray-500 mb-2">{item.start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {item.end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                            ) : (<div className="text-xs font-bold text-amber-600 mb-2 uppercase tracking-wide">Due Today</div>)}
                            {item.desc && <p className="text-xs text-gray-600 bg-gray-50 p-2.5 rounded-lg border border-gray-100 leading-relaxed">{item.desc}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </main>

      {/* ⭐️ NEW: Edit Modal ⭐️ */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all scale-100">
                <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                    <h3 className="text-lg font-bold text-gray-800">Edit {editingItem?.type === 'event' ? 'Event' : 'Task'}</h3>
                    <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 p-1 hover:bg-gray-200 rounded-full transition"><X size={20} /></button>
                </div>
                <form onSubmit={handleSave} className="p-6 space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Title</label>
                        <input type="text" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:bg-white transition outline-none font-medium" />
                    </div>
                    
                    {/* Conditional Fields based on Type */}
                    {editingItem?.type === 'event' ? (
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Start</label>
                                <input type="datetime-local" value={formData.start} onChange={e => setFormData({...formData, start: e.target.value})} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500 transition outline-none text-sm" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">End</label>
                                <input type="datetime-local" value={formData.end} onChange={e => setFormData({...formData, end: e.target.value})} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500 transition outline-none text-sm" />
                            </div>
                        </div>
                    ) : (
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Due Date</label>
                            <input type="date" value={formData.dueDate} onChange={e => setFormData({...formData, dueDate: e.target.value})} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500 transition outline-none text-sm" />
                        </div>
                    )}

                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Description</label>
                        <textarea rows="3" value={formData.desc} onChange={e => setFormData({...formData, desc: e.target.value})} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:bg-white transition outline-none text-sm"></textarea>
                    </div>

                    <div className="flex justify-end pt-2">
                        <button type="button" onClick={() => setIsModalOpen(false)} className="mr-3 px-5 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-100 rounded-xl transition">Cancel</button>
                        <button type="submit" className="flex items-center px-5 py-2.5 bg-teal-600 text-white text-sm font-semibold rounded-xl hover:bg-teal-700 shadow-lg hover:shadow-xl transition transform active:scale-95">
                            <Save size={16} className="mr-2" /> Save Changes
                        </button>
                    </div>
                </form>
            </div>
        </div>
      )}
    </div>
  );
}

export default App;