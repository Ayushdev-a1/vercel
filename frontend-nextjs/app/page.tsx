"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Github, Copy, Trash2, RotateCcw, LogOut, Eye } from "lucide-react";
import { Fira_Code } from "next/font/google";
import axios from "axios";

const socket = io("http://localhost:9002", {
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionAttempts: 5
});

const firaCode = Fira_Code({ subsets: ["latin"] });

interface Project {
  id: string;
  name: string;
  slug: string;
  git_url: string;
  status: string;
  created_at: string;
}

interface Deployment {
  id: string;
  project_id: string;
  status: string;
  build_logs: string;
  error_message: string | null;
  build_time: number | null;
  created_at: string;
  completed_at: string | null;
}

export default function Home() {
  const [repoURL, setURL] = useState<string>("");
  const [logs, setLogs] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [projectId, setProjectId] = useState<string | undefined>();
  const [deploymentId, setDeploymentId] = useState<string | undefined>();
  const [deployPreviewURL, setDeployPreviewURL] = useState<string | undefined>();
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [deploymentHistory, setDeploymentHistory] = useState<Deployment[]>([]);
  const [activeTab, setActiveTab] = useState<"deploy" | "projects" | "history">("deploy");
  const [deploymentStatus, setDeploymentStatus] = useState<string>("idle");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const logContainerRef = useRef<HTMLDivElement>(null);

  const isValidURL: [boolean, string | null] = useMemo(() => {
    if (!repoURL || repoURL.trim() === "") return [false, null];
    const regex = new RegExp(
      /^(?:https?:\/\/)?(?:www\.)?github\.com\/([^\/]+)\/([^\/]+)(?:\/)?$/
    );
    return [regex.test(repoURL), "Enter valid Github Repository URL"];
  }, [repoURL]);

  // Auto-scroll logs
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  // Load projects on mount
  useEffect(() => {
    loadProjects();
  }, []);

  // Socket listeners
  useEffect(() => {
    socket.on("message", (data) => {
      const message = typeof data === "string" ? data : data.log;
      setLogs(prev => [...prev, message]);
    });

    return () => {
      socket.off("message");
    };
  }, []);

  const loadProjects = async () => {
    try {
      const response = await axios.get("http://localhost:9000/projects");
      setProjects(response.data.data || []);
    } catch (err: any) {
      console.error("Error loading projects:", err);
      setError("Failed to load projects");
    }
  };

  const loadProjectDetails = async (project: Project) => {
    try {
      setSelectedProject(project);
      const response = await axios.get(`http://localhost:9000/project/${project.id}`);
      setDeploymentHistory(response.data.data.deployments || []);
    } catch (err: any) {
      console.error("Error loading project details:", err);
      setError("Failed to load project details");
    }
  };

  const handleClickDeploy = useCallback(async () => {
    if (!isValidURL[0]) {
      setError(isValidURL[1]);
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);
    setLogs([]);
    setDeploymentStatus("queued");

    try {
      const { data } = await axios.post("http://localhost:9000/project", {
        gitURL: repoURL,
        slug: undefined,
      });

      if (data && data.data) {
        const { projectSlug, projectId: pId, deploymentId: dId, url, previewUrl } = data.data;
        setProjectId(pId);
        setDeploymentId(dId);
        setDeployPreviewURL(url);
        setDeploymentStatus("building");
        setSuccess(`Deployment started! Slug: ${projectSlug}`);

        console.log(`Subscribing to logs:${projectSlug}`);
        socket.emit("subscribe", `logs:${projectSlug}`);

        // Poll for deployment status
        const statusInterval = setInterval(async () => {
          try {
            const statusRes = await axios.get(`http://localhost:9000/deployment/${dId}`);
            const deployment = statusRes.data.data.deployment;
            setDeploymentStatus(deployment.status);

            if (deployment.status === "success") {
              setSuccess("✅ Deployment successful!");
              clearInterval(statusInterval);
              setLoading(false);
              setTimeout(() => loadProjects(), 2000);
            } else if (deployment.status === "failed") {
              setError(`❌ Deployment failed: ${deployment.error_message}`);
              clearInterval(statusInterval);
              setLoading(false);
            }
          } catch (err) {
            console.error("Error polling status:", err);
          }
        }, 2000);

        // Stop polling after 30 minutes
        setTimeout(() => clearInterval(statusInterval), 30 * 60 * 1000);
      }
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message;
      setError(`Deployment error: ${errorMessage}`);
      setDeploymentStatus("failed");
      setLoading(false);
    }
  }, [isValidURL, repoURL]);

  const handleCopyURL = (url: string) => {
    navigator.clipboard.writeText(url);
    setSuccess("URL copied to clipboard!");
    setTimeout(() => setSuccess(null), 2000);
  };

  const handleDeleteProject = async (projectId: string) => {
    if (!confirm("Are you sure you want to delete this project?")) return;

    try {
      await axios.delete(`http://localhost:9000/project/${projectId}`);
      setSuccess("Project deleted successfully");
      loadProjects();
    } catch (err: any) {
      setError("Failed to delete project");
    }
  };

  const handleRedeploy = async (deployment: Deployment) => {
    if (!selectedProject) return;

    setLoading(true);
    setError(null);
    setLogs([]);
    setDeploymentStatus("queued");

    try {
      const { data } = await axios.post("http://localhost:9000/project", {
        gitURL: selectedProject.git_url,
      });

      if (data.data) {
        const { projectSlug, deploymentId: dId } = data.data;
        setDeploymentId(dId);
        setDeploymentStatus("building");

        socket.emit("subscribe", `logs:${projectSlug}`);
      }
    } catch (err: any) {
      setError("Failed to trigger redeploy");
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "success":
        return "text-green-500";
      case "failed":
        return "text-red-500";
      case "building":
        return "text-blue-500";
      case "queued":
        return "text-yellow-500";
      default:
        return "text-gray-400";
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case "success":
        return "bg-green-900 text-green-200";
      case "failed":
        return "bg-red-900 text-red-200";
      case "building":
        return "bg-blue-900 text-blue-200";
      case "queued":
        return "bg-yellow-900 text-yellow-200";
      default:
        return "bg-gray-700 text-gray-300";
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-950 text-white p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Github className="w-8 h-8 text-blue-400" />
            <h1 className="text-4xl font-bold">Vercel Clone</h1>
          </div>
          <p className="text-slate-400">Deploy your GitHub projects instantly</p>
        </div>

        {/* Alerts */}
        {error && (
          <div className="mb-4 p-4 bg-red-900/30 border border-red-500/50 rounded-lg text-red-200">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-4 p-4 bg-green-900/30 border border-green-500/50 rounded-lg text-green-200">
            {success}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-4 mb-8 border-b border-slate-700">
          <button
            onClick={() => setActiveTab("deploy")}
            className={`px-4 py-2 font-semibold transition-all ${
              activeTab === "deploy"
                ? "border-b-2 border-blue-500 text-blue-400"
                : "text-slate-400 hover:text-white"
            }`}
          >
            🚀 Deploy
          </button>
          <button
            onClick={() => { setActiveTab("projects"); loadProjects(); }}
            className={`px-4 py-2 font-semibold transition-all ${
              activeTab === "projects"
                ? "border-b-2 border-blue-500 text-blue-400"
                : "text-slate-400 hover:text-white"
            }`}
          >
            📁 Projects ({projects.length})
          </button>
          {selectedProject && (
            <button
              onClick={() => setActiveTab("history")}
              className={`px-4 py-2 font-semibold transition-all ${
                activeTab === "history"
                  ? "border-b-2 border-blue-500 text-blue-400"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              📜 History
            </button>
          )}
        </div>

        {/* Deploy Tab */}
        {activeTab === "deploy" && (
          <div className="grid lg:grid-cols-2 gap-8">
            {/* Deploy Form */}
            <div className="bg-slate-800/50 rounded-lg p-6 border border-slate-700">
              <h2 className="text-2xl font-bold mb-6">New Deployment</h2>

              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-sm font-semibold mb-2">
                    GitHub Repository URL
                  </label>
                  <Input
                    type="text"
                    placeholder="https://github.com/username/repository"
                    value={repoURL}
                    onChange={(e) => setURL(e.target.value)}
                    disabled={loading}
                    className="bg-slate-700 border-slate-600 text-white placeholder-slate-400"
                  />
                  {!isValidURL[0] && repoURL && (
                    <p className="text-red-400 text-sm mt-2">{isValidURL[1]}</p>
                  )}
                </div>
              </div>

              <Button
                onClick={handleClickDeploy}
                disabled={!isValidURL[0] || loading}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <div className="animate-spin inline-block mr-2 w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                    Deploying...
                  </>
                ) : (
                  "Deploy"
                )}
              </Button>

              {deployPreviewURL && (
                <div className="mt-6 p-4 bg-slate-700/50 rounded-lg border border-slate-600">
                  <p className="text-sm text-slate-400 mb-2">Preview URL:</p>
                  <div className="flex items-center gap-2">
                    <code className={`flex-1 text-sm bg-slate-900 p-2 rounded break-all ${firaCode.className}`}>
                      {deployPreviewURL}
                    </code>
                    <button
                      onClick={() => handleCopyURL(deployPreviewURL)}
                      className="p-2 hover:bg-slate-600 rounded transition-colors"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {deploymentStatus !== "idle" && (
                <div className="mt-6 p-4 bg-slate-700/50 rounded-lg border border-slate-600">
                  <p className="text-sm text-slate-400 mb-2">Deployment Status:</p>
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${
                      deploymentStatus === "success" ? "bg-green-500" :
                      deploymentStatus === "failed" ? "bg-red-500" :
                      deploymentStatus === "building" ? "bg-blue-500 animate-pulse" :
                      "bg-yellow-500"
                    }`} />
                    <span className={`capitalize font-semibold ${getStatusColor(deploymentStatus)}`}>
                      {deploymentStatus}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Logs */}
            <div className="bg-slate-800/50 rounded-lg p-6 border border-slate-700">
              <h2 className="text-2xl font-bold mb-4">Build Logs</h2>
              <div
                ref={logContainerRef}
                className={`bg-slate-900 rounded p-4 h-96 overflow-y-auto border border-slate-700 ${firaCode.className} text-sm`}
              >
                {logs.length === 0 ? (
                  <p className="text-slate-500">Logs will appear here...</p>
                ) : (
                  logs.map((log, i) => (
                    <div key={i} className="text-slate-300 break-words">
                      {log}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* Projects Tab */}
        {activeTab === "projects" && (
          <div className="bg-slate-800/50 rounded-lg p-6 border border-slate-700">
            <h2 className="text-2xl font-bold mb-6">All Projects</h2>

            {projects.length === 0 ? (
              <p className="text-slate-400 text-center py-8">No projects yet. Deploy one to get started!</p>
            ) : (
              <div className="space-y-4">
                {projects.map((project) => (
                  <div
                    key={project.id}
                    className="bg-slate-700/50 border border-slate-600 rounded-lg p-4 hover:border-slate-500 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-bold text-lg mb-2">{project.name}</h3>
                        <p className="text-slate-400 text-sm mb-3">{project.git_url}</p>
                        <div className="flex items-center gap-2">
                          <code className={`text-sm bg-slate-900 px-2 py-1 rounded ${firaCode.className}`}>
                            {project.slug}.localhost:8000
                          </code>
                          <button
                            onClick={() => handleCopyURL(`http://${project.slug}.localhost:8000`)}
                            className="p-1 hover:bg-slate-600 rounded"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => { setActiveTab("history"); loadProjectDetails(project); }}
                          className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-sm"
                        >
                          <Eye className="w-4 h-4 inline mr-1" /> Details
                        </button>
                        <button
                          onClick={() => handleDeleteProject(project.id)}
                          className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-sm"
                        >
                          <Trash2 className="w-4 h-4 inline mr-1" /> Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* History Tab */}
        {activeTab === "history" && selectedProject && (
          <div className="space-y-6">
            <div className="bg-slate-800/50 rounded-lg p-6 border border-slate-700">
              <h2 className="text-2xl font-bold mb-4">{selectedProject.name}</h2>
              <p className="text-slate-400 mb-4">{selectedProject.git_url}</p>

              <div className="grid md:grid-cols-3 gap-4">
                <div className="bg-slate-700/50 p-4 rounded border border-slate-600">
                  <p className="text-slate-400 text-sm">Preview URL</p>
                  <code className={`text-sm break-all ${firaCode.className}`}>
                    {selectedProject.slug}.localhost:8000
                  </code>
                </div>
                <div className="bg-slate-700/50 p-4 rounded border border-slate-600">
                  <p className="text-slate-400 text-sm">Created</p>
                  <p className="font-semibold">
                    {new Date(selectedProject.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="bg-slate-700/50 p-4 rounded border border-slate-600">
                  <p className="text-slate-400 text-sm">Total Deployments</p>
                  <p className="font-semibold">{deploymentHistory.length}</p>
                </div>
              </div>
            </div>

            <div className="bg-slate-800/50 rounded-lg p-6 border border-slate-700">
              <h3 className="text-xl font-bold mb-4">Deployment History</h3>

              {deploymentHistory.length === 0 ? (
                <p className="text-slate-400">No deployments yet</p>
              ) : (
                <div className="space-y-3">
                  {deploymentHistory.map((deployment) => (
                    <div
                      key={deployment.id}
                      className="bg-slate-700/50 border border-slate-600 rounded-lg p-4 hover:border-slate-500 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className={`px-3 py-1 rounded-full text-sm font-semibold ${getStatusBadgeColor(deployment.status)}`}>
                              {deployment.status}
                            </span>
                            {deployment.build_time && (
                              <span className="text-slate-400 text-sm">
                                {(deployment.build_time / 1000).toFixed(2)}s
                              </span>
                            )}
                          </div>
                          <p className="text-slate-400 text-sm">
                            {new Date(deployment.created_at).toLocaleString()}
                          </p>
                          {deployment.error_message && (
                            <p className="text-red-400 text-sm mt-2">Error: {deployment.error_message}</p>
                          )}
                        </div>
                        <button
                          onClick={() => handleRedeploy(deployment)}
                          className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-sm"
                        >
                          <RotateCcw className="w-4 h-4 inline mr-1" /> Redeploy
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
