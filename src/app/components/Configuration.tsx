import { useEffect, useMemo, useState } from "react";
import { Filter, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { configApi } from "../lib/api";
import { useClientPagination } from "../hooks/useClientPagination";
import type {
  ApiArticle,
  ApiLaborCategory,
  ApiUnit,
} from "../types/api";
import { TablePagination } from "./ui/table-pagination";

type LoadState = "idle" | "loading" | "error";

export function Configuration() {
  const [units, setUnits] = useState<ApiUnit[]>([]);
  const [articles, setArticles] = useState<ApiArticle[]>([]);
  const [laborCategories, setLaborCategories] = useState<ApiLaborCategory[]>(
    [],
  );
  const [status, setStatus] = useState<LoadState>("idle");

  const [unitDialog, setUnitDialog] = useState(false);
  const [articleDialog, setArticleDialog] = useState(false);
  const [laborDialog, setLaborDialog] = useState(false);

  const [editingUnit, setEditingUnit] = useState<ApiUnit | null>(null);
  const [editingArticle, setEditingArticle] = useState<ApiArticle | null>(null);
  const [editingLaborCategory, setEditingLaborCategory] =
    useState<ApiLaborCategory | null>(null);

  const [unitForm, setUnitForm] = useState({ name: "", symbol: "" });
  const [articleForm, setArticleForm] = useState({ name: "", code: "" });
  const [laborForm, setLaborForm] = useState({ name: "" });
  const [activeTab, setActiveTab] = useState("units");
  const [configSearchQuery, setConfigSearchQuery] = useState("");

  const loadConfig = async () => {
    setStatus("loading");
    try {
      const [unitsData, articlesData, laborCategoryData] =
        await Promise.all([
          configApi.listUnits(),
          configApi.listArticles(),
          configApi.listLaborCategories(),
        ]);

      setUnits(unitsData);
      setArticles(articlesData);
      setLaborCategories(laborCategoryData);
      setStatus("idle");
    } catch (error) {
      console.error(error);
      setStatus("error");
      toast.error("Failed to load configuration data.");
    }
  };

  useEffect(() => {
    loadConfig();
  }, []);

  const handleUnitSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      if (editingUnit) {
        await configApi.updateUnit(editingUnit.id, {
          name: unitForm.name.trim(),
          symbol: unitForm.symbol.trim() || null,
        });
        toast.success("Unit updated");
      } else {
        await configApi.createUnit({
          name: unitForm.name.trim(),
          symbol: unitForm.symbol.trim() || undefined,
        });
        toast.success("Unit added");
      }
      setUnitForm({ name: "", symbol: "" });
      setEditingUnit(null);
      setUnitDialog(false);
      await loadConfig();
    } catch (error) {
      console.error(error);
      toast.error("Unable to save unit.");
    }
  };

  const handleArticleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      if (editingArticle) {
        await configApi.updateArticle(editingArticle.id, {
          name: articleForm.name.trim(),
          code: articleForm.code.trim() || null,
        });
        toast.success("Article updated");
      } else {
        await configApi.createArticle({
          name: articleForm.name.trim(),
          code: articleForm.code.trim() || undefined,
        });
        toast.success("Article added");
      }
      setArticleForm({ name: "", code: "" });
      setEditingArticle(null);
      setArticleDialog(false);
      await loadConfig();
    } catch (error) {
      console.error(error);
      toast.error("Unable to save article.");
    }
  };

  const handleLaborSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editingLaborCategory) return;

    try {
      await configApi.updateLaborCategory(editingLaborCategory.id, {
        name: laborForm.name.trim(),
      });
      toast.success("Department name updated");
      setLaborForm({ name: "" });
      setEditingLaborCategory(null);
      setLaborDialog(false);
      await loadConfig();
    } catch (error) {
      console.error(error);
      toast.error("Unable to save department name.");
    }
  };

  const startUnitEdit = (unit: ApiUnit) => {
    setEditingUnit(unit);
    setUnitForm({ name: unit.name, symbol: unit.symbol || "" });
    setUnitDialog(true);
  };

  const startArticleEdit = (article: ApiArticle) => {
    setEditingArticle(article);
    setArticleForm({ name: article.name, code: article.code || "" });
    setArticleDialog(true);
  };

  const startLaborEdit = (category: ApiLaborCategory) => {
    setEditingLaborCategory(category);
    setLaborForm({ name: category.name });
    setLaborDialog(true);
  };

  const handleUnitDelete = async (unit: ApiUnit) => {
    if (!confirm(`Delete unit "${unit.name}"?`)) return;
    try {
      await configApi.deleteUnit(unit.id);
      toast.success("Unit moved to Deleted Items.");
      await loadConfig();
    } catch (error) {
      console.error(error);
      toast.error("Unable to delete unit.");
    }
  };

  const renderEmpty = (colSpan: number, message: string) => (
    <TableRow>
      <TableCell
        colSpan={colSpan}
        className="text-center text-muted-foreground"
      >
        {message}
      </TableCell>
    </TableRow>
  );

  const isLoading = status === "loading";

  const normalizedConfigQuery = configSearchQuery.trim().toLowerCase();

  const filteredUnits = useMemo(
    () =>
      units.filter((unit) =>
        [unit.name, unit.symbol || ""]
          .join(" ")
          .toLowerCase()
          .includes(normalizedConfigQuery),
      ),
    [normalizedConfigQuery, units],
  );

  const filteredArticles = useMemo(
    () =>
      articles.filter((article) =>
        [article.name, article.code || ""]
          .join(" ")
          .toLowerCase()
          .includes(normalizedConfigQuery),
      ),
    [articles, normalizedConfigQuery],
  );

  const filteredLaborCategories = useMemo(
    () =>
      laborCategories.filter((category) =>
        [category.id, category.name]
          .join(" ")
          .toLowerCase()
          .includes(normalizedConfigQuery),
      ),
    [laborCategories, normalizedConfigQuery],
  );

  const {
    currentPage: unitsPage,
    setCurrentPage: setUnitsPage,
    pageSize: unitsPageSize,
    setPageSize: setUnitsPageSize,
    totalPages: unitsTotalPages,
    totalItems: unitsTotalItems,
    startItem: unitsStartItem,
    endItem: unitsEndItem,
    paginatedItems: paginatedUnits,
    goToPreviousPage: goToPreviousUnitsPage,
    goToNextPage: goToNextUnitsPage,
  } = useClientPagination(filteredUnits);

  const {
    currentPage: articlesPage,
    setCurrentPage: setArticlesPage,
    pageSize: articlesPageSize,
    setPageSize: setArticlesPageSize,
    totalPages: articlesTotalPages,
    totalItems: articlesTotalItems,
    startItem: articlesStartItem,
    endItem: articlesEndItem,
    paginatedItems: paginatedArticles,
    goToPreviousPage: goToPreviousArticlesPage,
    goToNextPage: goToNextArticlesPage,
  } = useClientPagination(filteredArticles);

  const {
    currentPage: laborCategoriesPage,
    setCurrentPage: setLaborCategoriesPage,
    pageSize: laborCategoriesPageSize,
    setPageSize: setLaborCategoriesPageSize,
    totalPages: laborCategoriesTotalPages,
    totalItems: laborCategoriesTotalItems,
    startItem: laborCategoriesStartItem,
    endItem: laborCategoriesEndItem,
    paginatedItems: paginatedLaborCategories,
    goToPreviousPage: goToPreviousLaborCategoriesPage,
    goToNextPage: goToNextLaborCategoriesPage,
  } = useClientPagination(filteredLaborCategories);

  const clearConfigFilters = () => {
    setConfigSearchQuery("");
  };

  const configSearchPlaceholder =
    activeTab === "articles"
      ? "Search articles by name or code..."
      : activeTab === "labor-categories"
        ? "Search departments by id or name..."
        : "Search units by name or symbol...";

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>System Configuration</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs
            defaultValue="units"
            value={activeTab}
            onValueChange={setActiveTab}
          >
            <div className="flex items-center justify-between gap-3">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="units">Units</TabsTrigger>
                <TabsTrigger value="articles">Articles</TabsTrigger>
                <TabsTrigger value="labor-categories">
                  Labor Categories
                </TabsTrigger>
              </TabsList>
            </div>

            <div className="mt-4 flex flex-wrap items-end gap-3 rounded-md border border-dashed bg-muted/30 p-3">
              <div className="min-w-[240px] flex-1 md:max-w-[420px]">
                <Label className="mb-1.5 inline-block text-xs uppercase tracking-wide text-muted-foreground">
                  Search Current Tab
                </Label>
                <Input
                  value={configSearchQuery}
                  onChange={(event) => setConfigSearchQuery(event.target.value)}
                  placeholder={configSearchPlaceholder}
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={clearConfigFilters}
              >
                <Filter className="mr-2 h-4 w-4" />
                Reset Filters
              </Button>
            </div>

            <TabsContent
              value="units"
              className="space-y-4"
              data-report-tab="units"
            >
              <div className="flex justify-end">
                <Dialog
                  open={unitDialog}
                  onOpenChange={(open) => {
                    setUnitDialog(open);
                    if (!open) {
                      setEditingUnit(null);
                      setUnitForm({ name: "", symbol: "" });
                    }
                  }}
                >
                  <DialogTrigger asChild>
                    <Button
                      onClick={() => {
                        setEditingUnit(null);
                        setUnitForm({ name: "", symbol: "" });
                      }}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Add Unit
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>
                        {editingUnit ? "Edit Unit" : "Add Unit"}
                      </DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleUnitSubmit} className="space-y-4">
                      <div>
                        <Label>Unit Name</Label>
                        <Input
                          value={unitForm.name}
                          onChange={(event) =>
                            setUnitForm({
                              ...unitForm,
                              name: event.target.value,
                            })
                          }
                          required
                        />
                      </div>
                      <div>
                        <Label>Symbol (optional)</Label>
                        <Input
                          value={unitForm.symbol}
                          onChange={(event) =>
                            setUnitForm({
                              ...unitForm,
                              symbol: event.target.value,
                            })
                          }
                        />
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setUnitDialog(false)}
                        >
                          Cancel
                        </Button>
                        <Button type="submit">Save</Button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Symbol</TableHead>
                    <TableHead className="w-[140px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading
                    ? renderEmpty(3, "Loading units...")
                    : filteredUnits.length === 0
                      ? renderEmpty(
                          3,
                          units.length === 0
                            ? "No units yet"
                            : "No units match the current filters.",
                        )
                      : paginatedUnits.map((unit) => (
                          <TableRow key={unit.id}>
                            <TableCell>{unit.name}</TableCell>
                            <TableCell>{unit.symbol || "-"}</TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => startUnitEdit(unit)}
                                >
                                  Edit
                                </Button>
                                {/* <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleUnitDelete(unit)}
                                >
                                  Delete
                                </Button> */}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                </TableBody>
              </Table>
              <TablePagination
                currentPage={unitsPage}
                totalPages={unitsTotalPages}
                totalItems={unitsTotalItems}
                startItem={unitsStartItem}
                endItem={unitsEndItem}
                pageSize={unitsPageSize}
                setPageSize={setUnitsPageSize}
                goToPreviousPage={goToPreviousUnitsPage}
                goToNextPage={goToNextUnitsPage}
                setCurrentPage={setUnitsPage}
              />
            </TabsContent>

            <TabsContent
              value="articles"
              className="space-y-4"
              data-report-tab="articles"
            >
              <div className="flex justify-end">
                <Dialog
                  open={articleDialog}
                  onOpenChange={(open) => {
                    setArticleDialog(open);
                    if (!open) {
                      setEditingArticle(null);
                      setArticleForm({ name: "", code: "" });
                    }
                  }}
                >
                  <DialogTrigger asChild>
                    <Button
                      onClick={() => {
                        setEditingArticle(null);
                        setArticleForm({ name: "", code: "" });
                      }}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Add Article
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>
                        {editingArticle ? "Edit Article" : "Add Article"}
                      </DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleArticleSubmit} className="space-y-4">
                      <div>
                        <Label>Article Name</Label>
                        <Input
                          value={articleForm.name}
                          onChange={(event) =>
                            setArticleForm({
                              ...articleForm,
                              name: event.target.value,
                            })
                          }
                          required
                        />
                      </div>
                      <div>
                        <Label>Code (optional)</Label>
                        <Input
                          value={articleForm.code}
                          onChange={(event) =>
                            setArticleForm({
                              ...articleForm,
                              code: event.target.value,
                            })
                          }
                        />
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setArticleDialog(false)}
                        >
                          Cancel
                        </Button>
                        <Button type="submit">Save</Button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead className="w-[140px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading
                    ? renderEmpty(3, "Loading articles...")
                    : filteredArticles.length === 0
                      ? renderEmpty(
                          3,
                          articles.length === 0
                            ? "No articles yet"
                            : "No articles match the current filters.",
                        )
                      : paginatedArticles.map((article) => (
                          <TableRow key={article.id}>
                            <TableCell>{article.name}</TableCell>
                            <TableCell>{article.code || "-"}</TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => startArticleEdit(article)}
                                >
                                  Edit
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                </TableBody>
              </Table>
              <TablePagination
                currentPage={articlesPage}
                totalPages={articlesTotalPages}
                totalItems={articlesTotalItems}
                startItem={articlesStartItem}
                endItem={articlesEndItem}
                pageSize={articlesPageSize}
                setPageSize={setArticlesPageSize}
                goToPreviousPage={goToPreviousArticlesPage}
                goToNextPage={goToNextArticlesPage}
                setCurrentPage={setArticlesPage}
              />
            </TabsContent>

            <TabsContent
              value="labor-categories"
              className="space-y-4"
              data-report-tab="labor-categories"
            >
              <Dialog
                open={laborDialog}
                onOpenChange={(open) => {
                  setLaborDialog(open);
                  if (!open) {
                    setEditingLaborCategory(null);
                    setLaborForm({ name: "" });
                  }
                }}
              >
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Edit Department Name</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleLaborSubmit} className="space-y-4">
                    <div>
                      <Label>Department Name</Label>
                      <Input
                        value={laborForm.name}
                        onChange={(event) =>
                          setLaborForm({ name: event.target.value })
                        }
                        required
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setLaborDialog(false)}
                      >
                        Cancel
                      </Button>
                      <Button type="submit">Save</Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
              <p className="text-sm text-muted-foreground">
                Department ids stay fixed, but their display names can be
                edited.
              </p>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Department Id</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead className="w-[140px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading
                    ? renderEmpty(3, "Loading labor categories...")
                    : filteredLaborCategories.length === 0
                      ? renderEmpty(
                          3,
                          laborCategories.length === 0
                            ? "No labor categories yet"
                            : "No departments match the current filters.",
                        )
                      : paginatedLaborCategories.map((category) => (
                          <TableRow key={category.id}>
                            <TableCell>{category.id}</TableCell>
                            <TableCell>{category.name}</TableCell>
                            <TableCell>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => startLaborEdit(category)}
                              >
                                Edit
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                </TableBody>
              </Table>
              <TablePagination
                currentPage={laborCategoriesPage}
                totalPages={laborCategoriesTotalPages}
                totalItems={laborCategoriesTotalItems}
                startItem={laborCategoriesStartItem}
                endItem={laborCategoriesEndItem}
                pageSize={laborCategoriesPageSize}
                setPageSize={setLaborCategoriesPageSize}
                goToPreviousPage={goToPreviousLaborCategoriesPage}
                goToNextPage={goToNextLaborCategoriesPage}
                setCurrentPage={setLaborCategoriesPage}
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
