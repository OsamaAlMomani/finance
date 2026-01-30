import { useEffect, useState } from 'react';
import { Trash2, PlusCircle } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { CATEGORY_COLOR_OPTIONS, getCategoryColorClass } from '../utils/categoryColor';

type Theme = 'default' | 'girly' | 'men';

interface Category {
  id: string;
  name: string;
  type: string;
  color: string;
  icon?: string;
}

export const Settings = () => {
  const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem('theme') as Theme) || 'default');
  const [categories, setCategories] = useState<Category[]>([]);
  const [newCat, setNewCat] = useState({ name: '', type: 'expense', color: '#3B82F6' });

  const refreshCategories = async () => {
    if (window.electron) {
        const cats = await window.electron.invoke('db-get-categories');
        setCategories(cats);
    }
  };

  useEffect(() => {
    if (!window.electron) return;
    window.electron.invoke('db-get-categories').then((cats) => setCategories(cats));
  }, []);

  useEffect(() => {
    localStorage.setItem('theme', theme);
    document.body.classList.remove('girly-theme', 'men-theme');
    if (theme === 'girly') document.body.classList.add('girly-theme');
    if (theme === 'men') document.body.classList.add('men-theme');
  }, [theme]);

  const handleThemeChange = (t: Theme) => {
    setTheme(t);
  };

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if(!window.electron) return;
    await window.electron.invoke('db-create-category', {
        id: uuidv4(),
        ...newCat,
        icon: 'circle' // Default for now
    });
    setNewCat({ ...newCat, name: '' }); // Reset name only
    refreshCategories();
  };

  const handleDeleteCategory = async (id: string) => {
    if(!confirm("Delete category? Transactions will be uncategorized.")) return;
    if(!window.electron) return;
    await window.electron.invoke('db-delete-category', id);
    refreshCategories();
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h2 className="text-3xl font-bold mb-6 heading-font">App Settings</h2>
      
      <div className="card mb-8">
        <h3 className="text-xl mb-4 font-bold">Theme / Aesthetic</h3>
        <div className="flex gap-4 flex-wrap">
          <button 
            onClick={() => handleThemeChange('default')}
            className={`btn ${theme === 'default' ? 'bg-gray-200 border-gray-400' : 'bg-white border-gray-200'}`}
          >
            Default (Sketch)
          </button>
          
          <button 
            onClick={() => handleThemeChange('girly')}
            className={`btn ${theme === 'girly' ? 'bg-pink-100 border-pink-300' : 'bg-white border-gray-200'}`}
          >
            Girly (Watercolor)
          </button>
          
          <button 
            onClick={() => handleThemeChange('men')}
            className={`btn ${theme === 'men' ? 'bg-blue-100 border-blue-300' : 'bg-white border-gray-200'}`}
          >
            Men (Bold)
          </button>
        </div>
      </div>

        <div className="card">
            <h3 className="text-xl mb-4 font-bold">Categories</h3>
            
            <form onSubmit={handleAddCategory} className="flex gap-4 mb-6 p-4 bg-gray-50 rounded-lg border border-dashed border-gray-300 items-end">
                <div className="flex-1">
                <label htmlFor="settings-category-name" className="block text-sm font-bold mb-1">Name</label>
                    <input 
                        required
                  id="settings-category-name"
                        className="w-full p-2 border rounded"
                        value={newCat.name}
                        onChange={e => setNewCat({...newCat, name: e.target.value})}
                        placeholder="New Category..."
                    />
                </div>
                <div className="w-[120px]">
                <label htmlFor="settings-category-type" className="block text-sm font-bold mb-1">Type</label>
                    <select 
                  id="settings-category-type"
                        className="w-full p-2 border rounded"
                        value={newCat.type}
                        onChange={e => setNewCat({...newCat, type: e.target.value})}
                    >
                        <option value="expense">Expense</option>
                        <option value="income">Income</option>
                    </select>
                </div>
              <div>
                 <label htmlFor="settings-category-color" className="block text-sm font-bold mb-1">Color</label>
                 <div className="flex items-center gap-2">
                  <select
                    id="settings-category-color"
                    className="p-2 border rounded"
                    value={newCat.color}
                    onChange={e => setNewCat({...newCat, color: e.target.value})}
                  >
                    {CATEGORY_COLOR_OPTIONS.map(option => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                  <div className={`w-8 h-8 rounded-full border ${getCategoryColorClass(newCat.color)} category-color-swatch`} />
                 </div>
              </div>
                <button type="submit" className="btn bg-blue-500 text-white flex items-center gap-2 h-[42px]">
                    <PlusCircle size={20} /> Add
                </button>
            </form>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {categories.map(cat => (
                  <div key={cat.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50">
                        <div className="flex items-center gap-3">
                      <div className={`w-6 h-6 rounded-full ${getCategoryColorClass(cat.color)} category-color-swatch`} />
                            <div>
                                <p className="font-bold">{cat.name}</p>
                                <p className="text-xs text-gray-500 uppercase">{cat.type}</p>
                            </div>
                        </div>
                        <button 
                            onClick={() => handleDeleteCategory(cat.id)}
                            className="text-gray-400 hover:text-red-500"
                      aria-label={`Delete category ${cat.name}`}
                      title={`Delete category ${cat.name}`}
                        >
                            <Trash2 size={18} />
                        </button>
                    </div>
                ))}
            </div>
        </div>
    </div>
  );
};
