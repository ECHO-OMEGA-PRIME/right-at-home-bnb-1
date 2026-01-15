'use client';

/**
 * Right at Home BnB - Cleaning Checklist Page
 * Photo verification and issue reporting for cleaning crews
 * @author ECHO OMEGA PRIME
 */

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle2, Circle, Camera, AlertTriangle, Clock,
  Bed, Bath, UtensilsCrossed, Sofa, TreePine, Settings,
  ChevronRight, Upload, X, Send, Plus, Loader2,
  CheckCheck, AlertCircle, Image as ImageIcon
} from 'lucide-react';
import {
  CleaningSystem,
  masterChecklist,
  ChecklistItem,
  CompletedChecklistItem,
  CleaningReport,
  CleaningIssue,
  CompletionQuestions,
} from '@/lib/cleaning-system';

type Category = 'bedroom' | 'bathroom' | 'kitchen' | 'living' | 'exterior' | 'general';

const categories: { id: Category; label: string; icon: any }[] = [
  { id: 'bedroom', label: 'Bedroom', icon: Bed },
  { id: 'bathroom', label: 'Bathroom', icon: Bath },
  { id: 'kitchen', label: 'Kitchen', icon: UtensilsCrossed },
  { id: 'living', label: 'Living', icon: Sofa },
  { id: 'exterior', label: 'Exterior', icon: TreePine },
  { id: 'general', label: 'General', icon: Settings },
];

const severityColors = {
  low: 'bg-blue-100 text-blue-700 border-blue-200',
  medium: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  high: 'bg-orange-100 text-orange-700 border-orange-200',
  urgent: 'bg-red-100 text-red-700 border-red-200',
};

export default function CleaningChecklistPage() {
  const params = useParams();
  const router = useRouter();
  const reportId = params?.reportId as string;

  const [report, setReport] = useState<CleaningReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<Category>('bedroom');
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<ChecklistItem | null>(null);
  const [saving, setSaving] = useState(false);

  // Issue form state
  const [issueForm, setIssueForm] = useState({
    category: 'maintenance' as CleaningIssue['category'],
    severity: 'medium' as CleaningIssue['severity'],
    title: '',
    description: '',
    location: '',
    photoUrls: [] as string[],
  });

  // Completion questions state
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [completionForm, setCompletionForm] = useState<CompletionQuestions>({
    yardWorkNeeded: false,
    yardWorkNotes: '',
    yardWorkPhotos: [],
    maintenanceNeeded: false,
    maintenanceNotes: '',
    maintenancePhotos: [],
    hvacIssues: false,
    hvacNotes: '',
    applianceIssues: false,
    applianceNotes: '',
    guestLeftItems: false,
    guestItemsDescription: '',
    guestItemsPhotos: [],
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const completionPhotoRef = useRef<HTMLInputElement>(null);
  const [completionPhotoTarget, setCompletionPhotoTarget] = useState<'yard' | 'maintenance' | 'guest' | null>(null);

  useEffect(() => {
    loadReport();
  }, [reportId]);

  const loadReport = async () => {
    setLoading(true);
    try {
      const data = await CleaningSystem.getReport(reportId);
      setReport(data);
    } catch (error) {
      console.error('Error loading report:', error);
    }
    setLoading(false);
  };

  const handleStartJob = async () => {
    if (!report) return;
    setSaving(true);
    await CleaningSystem.startJob(reportId);
    await loadReport();
    setSaving(false);
  };

  const handleToggleItem = async (item: ChecklistItem) => {
    if (!report) return;

    const currentItem = report.checklist.find(c => c.itemId === item.id);
    const newCompleted = !currentItem?.completed;

    // If requires photo and being marked complete, show photo modal
    if (item.requiresPhoto && newCompleted && !currentItem?.photoUrl) {
      setSelectedItem(item);
      setShowPhotoModal(true);
      return;
    }

    setSaving(true);
    await CleaningSystem.updateItem(reportId, item.id, newCompleted);
    await loadReport();
    setSaving(false);
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedItem) return;

    // In production, upload to Firebase Storage
    // For now, create a local URL
    const photoUrl = URL.createObjectURL(file);

    setSaving(true);
    await CleaningSystem.updateItem(reportId, selectedItem.id, true, photoUrl);
    await loadReport();
    setSaving(false);
    setShowPhotoModal(false);
    setSelectedItem(null);
  };

  const handleSubmitIssue = async () => {
    if (!issueForm.title || !issueForm.description) return;

    setSaving(true);
    await CleaningSystem.addIssue(reportId, issueForm);
    await loadReport();
    setSaving(false);
    setShowIssueModal(false);
    setIssueForm({
      category: 'maintenance',
      severity: 'medium',
      title: '',
      description: '',
      location: '',
      photoUrls: [],
    });
  };

  const handleCompleteJob = async () => {
    if (!report) return;

    // Check if all required photos are taken
    const requiredPhotoItems = masterChecklist.filter(item => item.requiresPhoto);
    const missingPhotos = requiredPhotoItems.filter(item => {
      const checklistItem = report.checklist.find(c => c.itemId === item.id);
      return checklistItem?.completed && !checklistItem?.photoUrl;
    });

    if (missingPhotos.length > 0) {
      alert(`Please take photos for: ${missingPhotos.map(i => i.task).join(', ')}`);
      return;
    }

    // Show completion questions modal
    setShowCompletionModal(true);
  };

  const handleCompletionPhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !completionPhotoTarget) return;

    const photoUrl = URL.createObjectURL(file);

    if (completionPhotoTarget === 'yard') {
      setCompletionForm(prev => ({
        ...prev,
        yardWorkPhotos: [...(prev.yardWorkPhotos || []), photoUrl]
      }));
    } else if (completionPhotoTarget === 'maintenance') {
      setCompletionForm(prev => ({
        ...prev,
        maintenancePhotos: [...(prev.maintenancePhotos || []), photoUrl]
      }));
    } else if (completionPhotoTarget === 'guest') {
      setCompletionForm(prev => ({
        ...prev,
        guestItemsPhotos: [...(prev.guestItemsPhotos || []), photoUrl]
      }));
    }

    setCompletionPhotoTarget(null);
  };

  const handleFinalSubmit = async () => {
    if (!report) return;

    setSaving(true);
    try {
      // Submit completion questions and create service requests
      const propertyAddress = report.propertyName; // In production, get full address
      await CleaningSystem.submitCompletionQuestions(reportId, completionForm, propertyAddress);

      // Complete the cleaning job
      await CleaningSystem.complete(reportId);
      await loadReport();

      setShowCompletionModal(false);

      // Show success and redirect
      alert('Cleaning job completed! Any service requests have been sent to Steven.');
      router.push('/cleaning');
    } catch (error) {
      console.error('Error completing job:', error);
      alert('Error completing job. Please try again.');
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F5F5F0] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#500000]" />
      </div>
    );
  }

  if (!report) {
    return (
      <div className="min-h-screen bg-[#F5F5F0] flex items-center justify-center">
        <p className="text-[#2D2D2D]/60">Report not found</p>
      </div>
    );
  }

  const categoryItems = masterChecklist.filter(item => item.category === activeCategory);
  const completionPercentage = CleaningSystem.getCompletionPercentage(report.checklist);
  const categoryStatus = CleaningSystem.getCategoryStatus(report.checklist, activeCategory);

  return (
    <div className="min-h-screen bg-[#F5F5F0] pb-32">
      {/* Header */}
      <header className="bg-white border-b border-[#2D2D2D]/10 sticky top-0 z-20">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h1 className="text-lg font-semibold text-[#500000]">{report.propertyName}</h1>
              <p className="text-sm text-[#2D2D2D]/60 capitalize">{report.jobType.replace('_', ' ')}</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-[#500000]">{completionPercentage}%</p>
              <p className="text-xs text-[#2D2D2D]/60">Complete</p>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="h-2 bg-[#2D2D2D]/10 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-[#500000] to-[#722F37]"
              initial={{ width: 0 }}
              animate={{ width: `${completionPercentage}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>

          {/* Status Badge */}
          <div className="mt-3 flex items-center justify-between">
            <span className={`px-3 py-1 text-xs font-medium rounded-full ${
              report.status === 'completed' ? 'bg-green-100 text-green-700' :
              report.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
              'bg-gray-100 text-gray-600'
            }`}>
              {report.status === 'not_started' ? 'Not Started' :
               report.status === 'in_progress' ? 'In Progress' :
               report.status === 'completed' ? 'Completed' : 'Needs Review'}
            </span>

            {report.issues.length > 0 && (
              <span className="px-3 py-1 text-xs font-medium rounded-full bg-red-100 text-red-700">
                {report.issues.length} Issue{report.issues.length > 1 ? 's' : ''} Reported
              </span>
            )}
          </div>
        </div>

        {/* Category Tabs */}
        <div className="overflow-x-auto">
          <div className="flex px-4 pb-2 gap-2 min-w-max">
            {categories.map((cat) => {
              const status = CleaningSystem.getCategoryStatus(report.checklist, cat.id);
              return (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    activeCategory === cat.id
                      ? 'bg-[#500000] text-white'
                      : 'bg-white text-[#2D2D2D] hover:bg-[#500000]/10'
                  }`}
                >
                  <cat.icon className="w-4 h-4" />
                  {cat.label}
                  {status.completed === status.total && status.total > 0 && (
                    <CheckCircle2 className="w-4 h-4 text-green-400" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* Start Job Button (if not started) */}
      {report.status === 'not_started' && (
        <div className="max-w-2xl mx-auto px-4 py-6">
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={handleStartJob}
            disabled={saving}
            className="w-full py-4 bg-[#500000] text-white rounded-xl font-semibold text-lg hover:bg-[#722F37] transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Start Cleaning Job'}
          </motion.button>
        </div>
      )}

      {/* Checklist Items */}
      {report.status !== 'not_started' && (
        <main className="max-w-2xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-[#2D2D2D]/60">
              {categoryStatus.completed} of {categoryStatus.total} tasks
            </p>
            <button
              onClick={() => setShowIssueModal(true)}
              className="flex items-center gap-2 px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-sm font-medium hover:bg-red-100 transition-colors"
            >
              <AlertTriangle className="w-4 h-4" />
              Report Issue
            </button>
          </div>

          <div className="space-y-3">
            {categoryItems.map((item) => {
              const checklistItem = report.checklist.find(c => c.itemId === item.id);
              const isCompleted = checklistItem?.completed || false;
              const hasPhoto = !!checklistItem?.photoUrl;

              return (
                <motion.div
                  key={item.id}
                  layout
                  className={`bg-white rounded-xl border p-4 transition-colors ${
                    isCompleted ? 'border-green-200 bg-green-50/50' : 'border-[#2D2D2D]/10'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <button
                      onClick={() => handleToggleItem(item)}
                      className="mt-0.5 flex-shrink-0"
                      disabled={saving}
                    >
                      {isCompleted ? (
                        <CheckCircle2 className="w-6 h-6 text-green-500" />
                      ) : (
                        <Circle className="w-6 h-6 text-[#2D2D2D]/30" />
                      )}
                    </button>

                    <div className="flex-1">
                      <p className={`font-medium ${isCompleted ? 'text-green-700 line-through' : 'text-[#2D2D2D]'}`}>
                        {item.task}
                      </p>
                      {item.description && (
                        <p className="text-sm text-[#2D2D2D]/60 mt-0.5">{item.description}</p>
                      )}

                      {item.requiresPhoto && (
                        <div className="mt-2 flex items-center gap-2">
                          {hasPhoto ? (
                            <span className="flex items-center gap-1 text-xs text-green-600 bg-green-100 px-2 py-1 rounded-full">
                              <ImageIcon className="w-3 h-3" />
                              Photo Added
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-xs text-amber-600 bg-amber-100 px-2 py-1 rounded-full">
                              <Camera className="w-3 h-3" />
                              Photo Required
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {item.requiresPhoto && !hasPhoto && (
                      <button
                        onClick={() => {
                          setSelectedItem(item);
                          setShowPhotoModal(true);
                        }}
                        className="p-2 bg-[#500000]/10 text-[#500000] rounded-lg hover:bg-[#500000]/20 transition-colors"
                      >
                        <Camera className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Issues Section */}
          {report.issues.length > 0 && (
            <div className="mt-8">
              <h3 className="text-lg font-semibold text-[#2D2D2D] mb-3">Reported Issues</h3>
              <div className="space-y-3">
                {report.issues.map((issue) => (
                  <div
                    key={issue.id}
                    className={`p-4 rounded-xl border ${severityColors[issue.severity]}`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium">{issue.title}</p>
                        <p className="text-sm mt-1">{issue.description}</p>
                        {issue.location && (
                          <p className="text-xs mt-2 opacity-75">Location: {issue.location}</p>
                        )}
                      </div>
                      <span className="text-xs font-medium uppercase">{issue.severity}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </main>
      )}

      {/* Bottom Action Bar */}
      {report.status === 'in_progress' && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#2D2D2D]/10 p-4">
          <div className="max-w-2xl mx-auto">
            <button
              onClick={handleCompleteJob}
              disabled={saving || completionPercentage < 100}
              className="w-full py-4 bg-green-500 text-white rounded-xl font-semibold text-lg hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {saving ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <CheckCheck className="w-5 h-5" />
                  Complete Cleaning Job
                </>
              )}
            </button>
            {completionPercentage < 100 && (
              <p className="text-center text-sm text-[#2D2D2D]/60 mt-2">
                Complete all tasks to finish the job
              </p>
            )}
          </div>
        </div>
      )}

      {/* Photo Upload Modal */}
      <AnimatePresence>
        {showPhotoModal && selectedItem && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={() => setShowPhotoModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl p-6 max-w-md w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-[#2D2D2D]">Take Photo</h3>
                <button
                  onClick={() => setShowPhotoModal(false)}
                  className="p-2 hover:bg-gray-100 rounded-full"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <p className="text-[#2D2D2D]/60 mb-4">{selectedItem.task}</p>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handlePhotoUpload}
                className="hidden"
              />

              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-12 border-2 border-dashed border-[#500000]/30 rounded-xl flex flex-col items-center justify-center gap-2 hover:bg-[#500000]/5 transition-colors"
              >
                <Camera className="w-10 h-10 text-[#500000]" />
                <span className="text-[#500000] font-medium">Tap to Take Photo</span>
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Issue Report Modal */}
      <AnimatePresence>
        {showIssueModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center"
            onClick={() => setShowIssueModal(false)}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="bg-white rounded-t-2xl sm:rounded-2xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-[#2D2D2D]">Report Issue</h3>
                <button
                  onClick={() => setShowIssueModal(false)}
                  className="p-2 hover:bg-gray-100 rounded-full"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                {/* Category */}
                <div>
                  <label className="block text-sm font-medium text-[#2D2D2D] mb-2">Category</label>
                  <select
                    value={issueForm.category}
                    onChange={(e) => setIssueForm({ ...issueForm, category: e.target.value as any })}
                    className="w-full px-4 py-3 bg-[#F5F5F0] rounded-xl border-0 focus:ring-2 focus:ring-[#500000]/20"
                  >
                    <option value="maintenance">Maintenance Needed</option>
                    <option value="damage">Damage Found</option>
                    <option value="supply">Supplies Needed</option>
                    <option value="safety">Safety Concern</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                {/* Severity */}
                <div>
                  <label className="block text-sm font-medium text-[#2D2D2D] mb-2">Severity</label>
                  <div className="grid grid-cols-4 gap-2">
                    {(['low', 'medium', 'high', 'urgent'] as const).map((sev) => (
                      <button
                        key={sev}
                        onClick={() => setIssueForm({ ...issueForm, severity: sev })}
                        className={`py-2 px-3 rounded-lg text-sm font-medium capitalize transition-colors ${
                          issueForm.severity === sev
                            ? severityColors[sev]
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {sev}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Title */}
                <div>
                  <label className="block text-sm font-medium text-[#2D2D2D] mb-2">Issue Title</label>
                  <input
                    type="text"
                    value={issueForm.title}
                    onChange={(e) => setIssueForm({ ...issueForm, title: e.target.value })}
                    placeholder="Brief description of the issue"
                    className="w-full px-4 py-3 bg-[#F5F5F0] rounded-xl border-0 focus:ring-2 focus:ring-[#500000]/20"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-[#2D2D2D] mb-2">Details</label>
                  <textarea
                    value={issueForm.description}
                    onChange={(e) => setIssueForm({ ...issueForm, description: e.target.value })}
                    placeholder="Describe the issue in detail..."
                    rows={3}
                    className="w-full px-4 py-3 bg-[#F5F5F0] rounded-xl border-0 focus:ring-2 focus:ring-[#500000]/20 resize-none"
                  />
                </div>

                {/* Location */}
                <div>
                  <label className="block text-sm font-medium text-[#2D2D2D] mb-2">Location in Property</label>
                  <input
                    type="text"
                    value={issueForm.location}
                    onChange={(e) => setIssueForm({ ...issueForm, location: e.target.value })}
                    placeholder="e.g., Master bathroom, Kitchen sink"
                    className="w-full px-4 py-3 bg-[#F5F5F0] rounded-xl border-0 focus:ring-2 focus:ring-[#500000]/20"
                  />
                </div>

                {/* Submit Button */}
                <button
                  onClick={handleSubmitIssue}
                  disabled={!issueForm.title || !issueForm.description || saving}
                  className="w-full py-4 bg-red-500 text-white rounded-xl font-semibold hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {saving ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <AlertTriangle className="w-5 h-5" />
                      Submit Issue Report
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Completion Questions Modal */}
      <AnimatePresence>
        {showCompletionModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center"
            onClick={() => setShowCompletionModal(false)}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="bg-white rounded-t-2xl sm:rounded-2xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-[#2D2D2D]">Final Questions</h3>
                <button
                  onClick={() => setShowCompletionModal(false)}
                  className="p-2 hover:bg-gray-100 rounded-full"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <p className="text-sm text-[#2D2D2D]/60 mb-6">
                Before completing, please answer a few questions about the property condition.
              </p>

              <input
                ref={completionPhotoRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleCompletionPhotoUpload}
                className="hidden"
              />

              <div className="space-y-6">
                {/* Yard Work Question */}
                <div className="p-4 bg-green-50 rounded-xl">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <TreePine className="w-5 h-5 text-green-600" />
                      <span className="font-medium text-green-800">Is yard work needed?</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={completionForm.yardWorkNeeded}
                        onChange={(e) => setCompletionForm(prev => ({ ...prev, yardWorkNeeded: e.target.checked }))}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                    </label>
                  </div>

                  {completionForm.yardWorkNeeded && (
                    <div className="space-y-3 mt-3">
                      <textarea
                        value={completionForm.yardWorkNotes || ''}
                        onChange={(e) => setCompletionForm(prev => ({ ...prev, yardWorkNotes: e.target.value }))}
                        placeholder="Describe what yard work is needed..."
                        className="w-full px-3 py-2 bg-white rounded-lg border border-green-200 text-sm resize-none"
                        rows={2}
                      />
                      <div className="flex gap-2 flex-wrap">
                        {completionForm.yardWorkPhotos?.map((photo, i) => (
                          <img key={i} src={photo} alt={`Yard ${i + 1}`} className="w-16 h-16 object-cover rounded-lg" />
                        ))}
                        <button
                          onClick={() => {
                            setCompletionPhotoTarget('yard');
                            completionPhotoRef.current?.click();
                          }}
                          className="w-16 h-16 border-2 border-dashed border-green-300 rounded-lg flex items-center justify-center text-green-600"
                        >
                          <Camera className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Maintenance Question */}
                <div className="p-4 bg-orange-50 rounded-xl">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Settings className="w-5 h-5 text-orange-600" />
                      <span className="font-medium text-orange-800">Is maintenance/repairs needed?</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={completionForm.maintenanceNeeded}
                        onChange={(e) => setCompletionForm(prev => ({ ...prev, maintenanceNeeded: e.target.checked }))}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-600"></div>
                    </label>
                  </div>

                  {completionForm.maintenanceNeeded && (
                    <div className="space-y-3 mt-3">
                      <textarea
                        value={completionForm.maintenanceNotes || ''}
                        onChange={(e) => setCompletionForm(prev => ({ ...prev, maintenanceNotes: e.target.value }))}
                        placeholder="Describe what needs to be fixed (door handle, dryer, etc.)..."
                        className="w-full px-3 py-2 bg-white rounded-lg border border-orange-200 text-sm resize-none"
                        rows={2}
                      />
                      <div className="flex gap-2 flex-wrap">
                        {completionForm.maintenancePhotos?.map((photo, i) => (
                          <img key={i} src={photo} alt={`Maintenance ${i + 1}`} className="w-16 h-16 object-cover rounded-lg" />
                        ))}
                        <button
                          onClick={() => {
                            setCompletionPhotoTarget('maintenance');
                            completionPhotoRef.current?.click();
                          }}
                          className="w-16 h-16 border-2 border-dashed border-orange-300 rounded-lg flex items-center justify-center text-orange-600"
                        >
                          <Camera className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* HVAC Issues */}
                <div className="p-4 bg-blue-50 rounded-xl">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-blue-600">❄️</span>
                      <span className="font-medium text-blue-800">Any AC/heating issues?</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={completionForm.hvacIssues}
                        onChange={(e) => setCompletionForm(prev => ({ ...prev, hvacIssues: e.target.checked }))}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>
                  {completionForm.hvacIssues && (
                    <textarea
                      value={completionForm.hvacNotes || ''}
                      onChange={(e) => setCompletionForm(prev => ({ ...prev, hvacNotes: e.target.value }))}
                      placeholder="Describe the HVAC issue..."
                      className="w-full px-3 py-2 bg-white rounded-lg border border-blue-200 text-sm resize-none mt-3"
                      rows={2}
                    />
                  )}
                </div>

                {/* Appliance Issues */}
                <div className="p-4 bg-purple-50 rounded-xl">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-purple-600">🔌</span>
                      <span className="font-medium text-purple-800">Any appliance issues?</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={completionForm.applianceIssues}
                        onChange={(e) => setCompletionForm(prev => ({ ...prev, applianceIssues: e.target.checked }))}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                    </label>
                  </div>
                  {completionForm.applianceIssues && (
                    <textarea
                      value={completionForm.applianceNotes || ''}
                      onChange={(e) => setCompletionForm(prev => ({ ...prev, applianceNotes: e.target.value }))}
                      placeholder="Which appliance? What's the problem?"
                      className="w-full px-3 py-2 bg-white rounded-lg border border-purple-200 text-sm resize-none mt-3"
                      rows={2}
                    />
                  )}
                </div>

                {/* Guest Left Items */}
                <div className="p-4 bg-amber-50 rounded-xl">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-amber-600">📦</span>
                      <span className="font-medium text-amber-800">Did guest leave items behind?</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={completionForm.guestLeftItems}
                        onChange={(e) => setCompletionForm(prev => ({ ...prev, guestLeftItems: e.target.checked }))}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600"></div>
                    </label>
                  </div>

                  {completionForm.guestLeftItems && (
                    <div className="space-y-3 mt-3">
                      <textarea
                        value={completionForm.guestItemsDescription || ''}
                        onChange={(e) => setCompletionForm(prev => ({ ...prev, guestItemsDescription: e.target.value }))}
                        placeholder="What items were left? Where were they found?"
                        className="w-full px-3 py-2 bg-white rounded-lg border border-amber-200 text-sm resize-none"
                        rows={2}
                      />
                      <div className="flex gap-2 flex-wrap">
                        {completionForm.guestItemsPhotos?.map((photo, i) => (
                          <img key={i} src={photo} alt={`Item ${i + 1}`} className="w-16 h-16 object-cover rounded-lg" />
                        ))}
                        <button
                          onClick={() => {
                            setCompletionPhotoTarget('guest');
                            completionPhotoRef.current?.click();
                          }}
                          className="w-16 h-16 border-2 border-dashed border-amber-300 rounded-lg flex items-center justify-center text-amber-600"
                        >
                          <Camera className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Submit Button */}
                <button
                  onClick={handleFinalSubmit}
                  disabled={saving}
                  className="w-full py-4 bg-green-500 text-white rounded-xl font-semibold hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {saving ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <CheckCheck className="w-5 h-5" />
                      Submit & Complete Job
                    </>
                  )}
                </button>

                {(completionForm.yardWorkNeeded || completionForm.maintenanceNeeded || completionForm.hvacIssues || completionForm.applianceIssues) && (
                  <p className="text-xs text-center text-gray-500">
                    Steven will receive a notification with your photos and notes.
                  </p>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
