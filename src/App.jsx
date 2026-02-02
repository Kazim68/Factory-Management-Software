import { useEffect, useState } from "react";

export default function App() {
  const [todos, setTodos] = useState([]);
  const [text, setText] = useState("");

  useEffect(() => {
    window.api.getTodos().then(setTodos);
  }, []);

  const addTodo = async () => {
    await window.api.addTodo(text);
    setText("");
    setTodos(await window.api.getTodos());
  };

  return (
    <div style={{ padding: 20 }}>
      <h2>Electron Todo</h2>
      <input value={text} onChange={e => setText(e.target.value)} />
      <button onClick={addTodo}>Add</button>

      <ul>
        {todos.map(t => <li key={t.id}>{t.text}</li>)}
      </ul>
    </div>
  );
}
