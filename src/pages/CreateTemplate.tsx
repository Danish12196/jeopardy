import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import pb from "@/pb";

export default function CreateTemplate() {
  const [title, setTitle] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [availableCategories, setAvailableCategories] = useState<any[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [availableQuestions, setAvailableQuestions] = useState<any[]>([]);
  const [selectedQuestions, setSelectedQuestions] = useState<string[]>([]);

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
        try {
            const cats = await pb.collection("question_categories").getFullList({ sort: "-created", expand: "user" });
            const qs = await pb.collection("questions").getFullList({ sort: "-created", expand: "user,category" });

            setAvailableCategories(cats);
            setAvailableQuestions(qs);
        } catch (err) {
            console.error("Failed to fetch data for create template:", err);
        }
    };
    fetchData();
  }, []);

  const toggleCategory = (id: string) => {
    if (selectedCategories.includes(id)) {
        setSelectedCategories(selectedCategories.filter(c => c !== id));
        // Also remove questions belonging to this category
        const questionsToRemove = availableQuestions.filter(q => q.category === id).map(q => q.id);
        setSelectedQuestions(selectedQuestions.filter(q => !questionsToRemove.includes(q)));
    } else {
        setSelectedCategories([...selectedCategories, id]);
    }
  };

  const toggleQuestion = (id: string) => {
      if (selectedQuestions.includes(id)) {
          setSelectedQuestions(selectedQuestions.filter(q => q !== id));
      } else {
          setSelectedQuestions([...selectedQuestions, id]);
      }
  };

  const createTemplate = async () => {
      if (!title.trim()) {
          setError("Title is required.");
          return;
      }
      if (selectedCategories.length === 0) {
          setError("Select at least one category.");
          return;
      }

      setLoading(true);
      setError(null);
      setSuccess(false);

      try {
          await pb.collection("game_templates").create({
              title,
              isPublic,
              user: pb.authStore.model?.id,
              categories: selectedCategories,
              questions: selectedQuestions
          });
          setSuccess(true);
          setTitle("");
          setSelectedCategories([]);
          setSelectedQuestions([]);
          setIsPublic(false);
      } catch (err: any) {
          setError(err.message || "Failed to create template");
      } finally {
          setLoading(false);
      }
  };

  return (
      <div className="bg-blue-800 p-4 rounded border border-blue-600">
          <h2 className="text-xl font-bold mb-4">Create New Template</h2>

          <div className="flex gap-4 mb-4">
            <div className="flex-1">
                <label className="block mb-1 text-sm font-semibold">Template Title</label>
                <Input
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    placeholder="E.g., Friday Trivia"
                    className="text-black bg-white"
                />
            </div>
            <div className="flex items-end mb-1">
                <label className="flex items-center gap-2 text-sm bg-blue-900 px-4 py-2 rounded border border-blue-700">
                    <input type="checkbox" checked={isPublic} onChange={e => setIsPublic(e.target.checked)} />
                    Make Public
                </label>
            </div>
          </div>

          <div className="mb-6">
              <label className="block mb-2 font-semibold border-b border-blue-700 pb-1">Select Categories</label>
              <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto p-2 bg-blue-950 rounded border border-blue-900">
                  {availableCategories.map(cat => {
                      const isMine = cat.user === pb.authStore.model?.id;
                      return (
                          <button
                              key={cat.id}
                              onClick={() => toggleCategory(cat.id)}
                              className={`px-3 py-1 rounded text-sm ${
                                  selectedCategories.includes(cat.id)
                                  ? "bg-green-600 text-white"
                                  : "bg-gray-700 hover:bg-gray-600 text-gray-200"
                              }`}
                          >
                              {cat.name} {!isMine && "(Public)"}
                          </button>
                      );
                  })}
              </div>
          </div>

          {selectedCategories.length > 0 && (
              <div className="mb-6">
                <label className="block mb-2 font-semibold border-b border-blue-700 pb-1">Select Questions for Included Categories</label>
                <div className="flex flex-col gap-4 max-h-64 overflow-y-auto p-2 bg-blue-950 rounded border border-blue-900">
                    {selectedCategories.map(catId => {
                        const cat = availableCategories.find(c => c.id === catId);
                        const qs = availableQuestions.filter(q => q.category === catId);

                        return (
                            <div key={catId} className="bg-blue-900 p-2 rounded">
                                <h4 className="font-bold text-yellow-400 mb-2">{cat?.name}</h4>
                                {qs.length === 0 ? <p className="text-sm text-gray-400">No questions available.</p> : (
                                    <div className="flex flex-col gap-2">
                                        {qs.map(q => (
                                            <div
                                                key={q.id}
                                                onClick={() => toggleQuestion(q.id)}
                                                className={`p-2 rounded cursor-pointer text-sm flex gap-2 ${
                                                    selectedQuestions.includes(q.id)
                                                    ? "bg-green-800 border-l-4 border-green-400"
                                                    : "bg-blue-950 hover:bg-blue-800"
                                                }`}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={selectedQuestions.includes(q.id)}
                                                    readOnly
                                                    className="mt-1"
                                                />
                                                <div>
                                                    <div className="font-semibold">{q.question}</div>
                                                    <div className="text-gray-400">A: {q.answer}</div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
              </div>
          )}

          <Button
            onClick={createTemplate}
            disabled={loading}
            className="w-full bg-yellow-400 hover:bg-yellow-500 text-black font-bold py-2 mt-4"
          >
              {loading ? "Creating..." : "Save Template"}
          </Button>

          {error && <p className="mt-2 text-sm text-red-400 font-bold">{error}</p>}
          {success && <p className="mt-2 text-sm text-green-400 font-bold">Template created successfully!</p>}
      </div>
  );
}
