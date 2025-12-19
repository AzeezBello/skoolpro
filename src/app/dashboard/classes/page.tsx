"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import toast from "react-hot-toast";

interface Teacher {
  id: string;
  full_name: string;
}

interface ClassItem {
  id: string;
  name: string;
  teacher_id?: string | null;
  created_at?: string;
}

export default function ClassesPage() {
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [newClass, setNewClass] = useState({ name: "", teacher_id: "" });
  const [editing, setEditing] = useState<ClassItem | null>(null);

  useEffect(() => {
    fetchClasses();
    fetchTeachers();
  }, []);

  const fetchClasses = async () => {
    const { data, error } = await supabase.from("classes").select("*, teachers(full_name)");
    if (error) toast.error(error.message);
    else setClasses(data || []);
  };

  const fetchTeachers = async () => {
    const { data } = await supabase.from("teachers").select("id, full_name");
    setTeachers(data || []);
  };

  const addClass = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.from("classes").insert([newClass]);
    if (error) toast.error(error.message);
    else {
      toast.success("Class added!");
      setNewClass({ name: "", teacher_id: "" });
      fetchClasses();
    }
  };

  const updateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    const { error } = await supabase
      .from("classes")
      .update({ name: editing.name, teacher_id: editing.teacher_id })
      .eq("id", editing.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Updated!");
      setEditing(null);
      fetchClasses();
    }
  };

  const deleteClass = async (id: string) => {
    if (!confirm("Delete this class?")) return;
    const { error } = await supabase.from("classes").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Deleted!");
      fetchClasses();
    }
  };

  return (
    <div className="p-8 bg-gray-900 text-white min-h-screen">
      <h1 className="text-3xl font-semibold mb-6">Manage Classes</h1>

      {/* Add or Edit Form */}
      <form
        onSubmit={editing ? updateClass : addClass}
        className="bg-gray-800 p-6 rounded-lg mb-8 flex flex-col md:flex-row gap-3"
      >
        <input
          type="text"
          placeholder="Class Name"
          value={editing ? editing.name : newClass.name}
          onChange={(e) =>
            editing
              ? setEditing({ ...editing, name: e.target.value })
              : setNewClass({ ...newClass, name: e.target.value })
          }
          className="flex-1 p-2 bg-gray-700 rounded text-white"
        />
        <select
          value={editing ? editing.teacher_id || "" : newClass.teacher_id}
          onChange={(e) =>
            editing
              ? setEditing({ ...editing, teacher_id: e.target.value })
              : setNewClass({ ...newClass, teacher_id: e.target.value })
          }
          className="flex-1 p-2 bg-gray-700 rounded text-white"
        >
          <option value="">Assign Teacher</option>
          {teachers.map((t) => (
            <option key={t.id} value={t.id}>
              {t.full_name}
            </option>
          ))}
        </select>
        <button className="bg-green-600 px-5 py-2 rounded hover:bg-green-700">
          {editing ? "Update" : "Add Class"}
        </button>
        {editing && (
          <button onClick={() => setEditing(null)} type="button" className="bg-gray-600 px-4 py-2 rounded">
            Cancel
          </button>
        )}
      </form>

      {/* Classes Table */}
      {classes.length === 0 ? (
        <p className="text-gray-400">No classes yet.</p>
      ) : (
        <table className="w-full bg-gray-800 rounded-lg overflow-hidden">
          <thead className="bg-gray-700 text-gray-300">
            <tr>
              <th className="p-3">Class Name</th>
              <th className="p-3">Teacher</th>
              <th className="p-3 text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {classes.map((cls) => (
              <tr key={cls.id} className="border-b border-gray-700 hover:bg-gray-750">
                <td className="p-3">{cls.name}</td>
                <td className="p-3">{cls.teachers?.full_name || "—"}</td>
                <td className="p-3 text-center">
                  <button onClick={() => setEditing(cls)} className="bg-blue-600 px-3 py-1 rounded mr-2 hover:bg-blue-700">
                    Edit
                  </button>
                  <button
                    onClick={() => deleteClass(cls.id)}
                    className="bg-red-600 px-3 py-1 rounded hover:bg-red-700"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
