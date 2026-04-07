import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Send, 
  CheckCircle2, 
  AlertCircle, 
  Calendar, 
  User, 
  Mail, 
  Briefcase, 
  Palette, 
  Image as ImageIcon, 
  FileText,
  Box,
  Layers,
  ArrowRight,
  Loader2
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Types ---
type ArtworkType = '3D' | '2D';

interface FormData {
  email: string;
  brand: string;
  department: string;
  employeeName: string;
  storeName: string;
  description: string;
  color: string;
  imageReference: string;
  remarks: string;
  artworkType: ArtworkType | '';
  // 2D Fields
  width2d: string;
  lengthHeight2d: string;
  styleNoColor2d: string;
  // 3D Fields
  width3d: string;
  length3d: string;
  height3d: string;
  deliveryDate: string;
}

const INITIAL_DATA: FormData = {
  email: '',
  brand: '',
  department: '',
  employeeName: '',
  storeName: '',
  description: '',
  color: '',
  imageReference: '',
  remarks: '',
  artworkType: '',
  width2d: '',
  lengthHeight2d: '',
  styleNoColor2d: '',
  width3d: '',
  length3d: '',
  height3d: '',
  deliveryDate: '',
};

export default function App() {
  const [formData, setFormData] = useState<FormData>({
    ...INITIAL_DATA,
    email: 'mis.mumbai@ginzalimited.com' // Pre-filled as per "automatic collection"
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  // Auto-calculated fields
  const [timestamp, setTimestamp] = useState('');
  const [minDeliveryDate, setMinDeliveryDate] = useState('');

  useEffect(() => {
    const updateDates = () => {
      const now = new Date();
      const future = new Date(now);
      future.setDate(now.getDate() + 4);

      setTimestamp(now.toLocaleString());
      
      // Format for date input min attribute (YYYY-MM-DD)
      const year = future.getFullYear();
      const month = String(future.getMonth() + 1).padStart(2, '0');
      const day = String(future.getDate()).padStart(2, '0');
      const minDateStr = `${year}-${month}-${day}`;
      
      setMinDeliveryDate(minDateStr);
      setFormData(prev => ({ ...prev, deliveryDate: minDateStr }));
    };

    updateDates();
    const interval = setInterval(updateDates, 60000); // Update every minute
    return () => clearInterval(interval);
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const toggleArtworkType = (type: ArtworkType) => {
    setFormData(prev => ({
      ...prev,
      artworkType: prev.artworkType === type ? '' : type
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitStatus('idle');

    try {
      const response = await fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          timestamp,
        }),
      });

      const result = await response.json();

      if (result.success) {
        setSubmitStatus('success');
        setFormData({
          ...INITIAL_DATA,
          email: 'mis.mumbai@ginzalimited.com',
          deliveryDate: minDeliveryDate
        });
      } else {
        throw new Error(result.message || 'Submission failed');
      }
    } catch (err: any) {
      setSubmitStatus('error');
      setErrorMessage(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F0EBF8] py-8 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-3xl mx-auto space-y-6">
        
        {/* Header Image & Title Card */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden border-t-[10px] border-[#673AB7]">
          <div className="h-32 bg-gradient-to-r from-[#673AB7] to-[#9575CD] flex items-center justify-center relative overflow-hidden">
            <div className="absolute inset-0 opacity-20">
              <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white via-transparent to-transparent"></div>
            </div>
            <motion.div 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="text-center z-10"
            >
              <h1 className="text-4xl font-bold text-white mb-2 tracking-tight">Creative Requisition Form</h1>
              <p className="text-purple-100 text-sm font-medium uppercase tracking-widest">Design & Production Request</p>
            </motion.div>
          </div>
          
          <div className="p-6 border-b border-gray-100">
            <p className="text-gray-600 text-sm leading-relaxed">
              Please fill out this form for all creative requirements. Responses are automatically synced to the master spreadsheet.
            </p>
            <div className="mt-4 flex flex-wrap gap-4 text-xs font-medium text-gray-400">
              <div className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" />
                <span>{timestamp}</span>
              </div>
              <div className="flex items-center gap-1.5 text-purple-600">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Collecting email: {formData.email}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Form Content */}
        <form onSubmit={handleSubmit} className="space-y-4">
          
          {/* Basic Information Section */}
          <Section title="Basic Information" icon={<User className="w-5 h-5 text-purple-500" />}>
            <div className="flex flex-col gap-6">
              <InputGroup label="Email Address" required>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="email"
                    name="email"
                    required
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="your@email.com"
                    className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all outline-none text-base"
                  />
                </div>
                <p className="text-[10px] text-gray-400 mt-1 ml-1">Required to send response copies</p>
              </InputGroup>

              <InputGroup label="Brand" required>
                <select
                  name="brand"
                  required
                  value={formData.brand}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all outline-none appearance-none text-base"
                >
                  <option value="">Select Brand</option>
                  <option value="SOIE">SOIE</option>
                  <option value="HEKTOR">HEKTOR</option>
                </select>
              </InputGroup>

              <InputGroup label="Department" required>
                <div className="relative">
                  <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    name="department"
                    required
                    value={formData.department}
                    onChange={handleChange}
                    placeholder="e.g. Marketing"
                    className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all outline-none text-base"
                  />
                </div>
              </InputGroup>

              <InputGroup label="Employee Name" required>
                <input
                  type="text"
                  name="employeeName"
                  required
                  value={formData.employeeName}
                  onChange={handleChange}
                  placeholder="Full Name"
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all outline-none text-base"
                />
              </InputGroup>

              <InputGroup label="Store / Portal / Brand Name" required>
                <input
                  type="text"
                  name="storeName"
                  required
                  value={formData.storeName}
                  onChange={handleChange}
                  placeholder="Brand / Store / Portal Name"
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all outline-none text-base"
                />
              </InputGroup>
            </div>
          </Section>

          {/* Creative Details Section */}
          <Section title="Creative Details" icon={<Palette className="w-5 h-5 text-purple-500" />}>
            <div className="space-y-6">
              <InputGroup label="Description of Creative" required>
                <textarea
                  name="description"
                  required
                  rows={3}
                  value={formData.description}
                  onChange={handleChange}
                  placeholder="Describe what you need..."
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all outline-none resize-none text-base"
                />
              </InputGroup>

              <div className="flex flex-col gap-6">
                <InputGroup label="Color" required>
                  <input
                    type="text"
                    name="color"
                    required
                    value={formData.color}
                    onChange={handleChange}
                    placeholder="e.g. #673AB7 or Royal Blue"
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all outline-none"
                  />
                </InputGroup>

                <InputGroup label="Image Reference (URL)">
                  <div className="relative">
                    <ImageIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="url"
                      name="imageReference"
                      value={formData.imageReference}
                      onChange={handleChange}
                      placeholder="https://..."
                      className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all outline-none"
                    />
                  </div>
                </InputGroup>
              </div>

              <div className="p-4 bg-purple-50 rounded-lg border border-purple-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Calendar className="w-5 h-5 text-purple-600" />
                  <div>
                    <p className="text-xs font-semibold text-purple-900 uppercase tracking-wider">Required Delivery Date</p>
                  </div>
                </div>
                <input
                  type="date"
                  name="deliveryDate"
                  min={minDeliveryDate}
                  value={formData.deliveryDate}
                  onChange={handleChange}
                  className="bg-white border border-purple-200 rounded px-2 py-1 text-purple-900 font-bold text-sm outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <InputGroup label="Extra Remarks if any">
                <textarea
                  name="remarks"
                  rows={2}
                  value={formData.remarks}
                  onChange={handleChange}
                  placeholder="Any additional instructions..."
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all outline-none resize-none"
                />
              </InputGroup>
            </div>
          </Section>

          {/* Artwork Specifications Section */}
          <Section title="Artwork Specifications" icon={<Layers className="w-5 h-5 text-purple-500" />}>
            <div className="space-y-6">
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => toggleArtworkType('3D')}
                  className={cn(
                    "flex items-center gap-2 px-3 py-1.5 rounded-lg border-2 transition-all",
                    formData.artworkType === '3D' 
                      ? "border-purple-500 bg-purple-50 text-purple-700" 
                      : "border-gray-100 bg-gray-50 text-gray-500 hover:border-purple-200"
                  )}
                >
                  <Box className="w-4 h-4" />
                  <div className="text-left">
                    <p className="font-bold text-xs leading-none">3D ARTWORKS</p>
                    <p className="text-[8px] opacity-70 uppercase tracking-tighter leading-none mt-0.5">Boxes / Packs</p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => toggleArtworkType('2D')}
                  className={cn(
                    "flex items-center gap-2 px-3 py-1.5 rounded-lg border-2 transition-all",
                    formData.artworkType === '2D' 
                      ? "border-purple-500 bg-purple-50 text-purple-700" 
                      : "border-gray-100 bg-gray-50 text-gray-500 hover:border-purple-200"
                  )}
                >
                  <Layers className="w-4 h-4" />
                  <div className="text-left">
                    <p className="font-bold text-xs leading-none">2D / FLAT ARTWORKS</p>
                    <p className="text-[8px] opacity-70 uppercase tracking-tighter leading-none mt-0.5">Inlays / Posters</p>
                  </div>
                </button>
              </div>

              <AnimatePresence mode="wait">
                {formData.artworkType === '2D' && (
                  <motion.div
                    key="2d-fields"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="flex flex-col gap-4 p-4 bg-gray-50 rounded-xl border border-gray-100"
                  >
                    <InputGroup label="Width">
                      <input
                        type="text"
                        name="width2d"
                        value={formData.width2d}
                        onChange={handleChange}
                        placeholder="Inches or CMS"
                        className="w-full px-4 py-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                      />
                    </InputGroup>
                    <InputGroup label="Length / Height">
                      <input
                        type="text"
                        name="lengthHeight2d"
                        value={formData.lengthHeight2d}
                        onChange={handleChange}
                        placeholder="Inches or CMS"
                        className="w-full px-4 py-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                      />
                    </InputGroup>
                    <InputGroup label="Style no with colour">
                      <input
                        type="text"
                        name="styleNoColor2d"
                        value={formData.styleNoColor2d}
                        onChange={handleChange}
                        placeholder="e.g. S123 Red"
                        className="w-full px-4 py-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                      />
                    </InputGroup>
                  </motion.div>
                )}

                {formData.artworkType === '3D' && (
                  <motion.div
                    key="3d-fields"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="flex flex-col gap-4 p-4 bg-gray-50 rounded-xl border border-gray-100"
                  >
                    <InputGroup label="Width">
                      <input
                        type="text"
                        name="width3d"
                        value={formData.width3d}
                        onChange={handleChange}
                        placeholder="Inches or CMS"
                        className="w-full px-4 py-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                      />
                    </InputGroup>
                    <InputGroup label="Length">
                      <input
                        type="text"
                        name="length3d"
                        value={formData.length3d}
                        onChange={handleChange}
                        placeholder="Inches or CMS"
                        className="w-full px-4 py-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                      />
                    </InputGroup>
                    <InputGroup label="Height">
                      <input
                        type="text"
                        name="height3d"
                        value={formData.height3d}
                        onChange={handleChange}
                        placeholder="Inches or CMS"
                        className="w-full px-4 py-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                      />
                    </InputGroup>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </Section>

          {/* Submit Button & Status */}
          <div className="pt-4">
            <button
              type="submit"
              disabled={isSubmitting || !formData.artworkType}
              className={cn(
                "w-full py-4 rounded-xl font-bold text-white shadow-lg transition-all flex items-center justify-center gap-2",
                isSubmitting ? "bg-gray-400 cursor-not-allowed" : "bg-[#673AB7] hover:bg-[#5E35B1] active:scale-[0.98]"
              )}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Submitting to Sheets...</span>
                </>
              ) : (
                <>
                  <Send className="w-5 h-5" />
                  <span>Submit Requisition</span>
                </>
              )}
            </button>

            <AnimatePresence>
              {submitStatus === 'success' && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-4 p-4 bg-green-50 border border-green-200 rounded-xl flex items-center gap-3 text-green-800"
                >
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                  <p className="text-sm font-medium">Form submitted successfully! Your request has been logged.</p>
                </motion.div>
              )}

              {submitStatus === 'error' && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-4 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3 text-red-800"
                >
                  <AlertCircle className="w-5 h-5 text-red-500" />
                  <p className="text-sm font-medium">Error: {errorMessage}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </form>

        {/* Footer */}
        <footer className="text-center py-8">
          <p className="text-xs text-gray-400 font-medium uppercase tracking-widest">
            Powered by Google AI Studio & Google Sheets
          </p>
        </footer>
      </div>
    </div>
  );
}

// --- Helper Components ---

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden"
    >
      <div className="px-6 py-4 border-b border-gray-50 bg-gray-50/50 flex items-center gap-3">
        {icon}
        <h2 className="font-bold text-gray-800 tracking-tight">{title}</h2>
      </div>
      <div className="p-6">
        {children}
      </div>
    </motion.div>
  );
}

function InputGroup({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-base font-bold text-gray-700 ml-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
    </div>
  );
}
