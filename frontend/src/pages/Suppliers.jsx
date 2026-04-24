import EntityPage from '../components/EntityPage';

function Suppliers() {
  return (
    <EntityPage
      title="Suppliers"
      subtitle="Manage medicine suppliers and their contact information."
      endpoint="/suppliers"
      idField="supplier_id"
      fields={[
        { name: 'company_name', label: 'Company Name', required: true },
        { name: 'contact_first', label: 'Contact First Name', required: true },
        { name: 'contact_last', label: 'Contact Last Name', required: true },
        { name: 'contact_number', label: 'Contact Number' },
        { name: 'address', label: 'Address' },
        { name: 'license_number', label: 'License Number' },
        { name: 'rating', label: 'Rating (0-5)', type: 'number', step: '0.1', hint: 'Supplier performance rating (0–5)' },
      ]}
      columns={[
        { key: 'supplier_id', label: 'ID' },
        { key: 'company_name', label: 'Company' },
        { key: 'contact_first', label: 'First Name' },
        { key: 'contact_last', label: 'Last Name' },
        { key: 'contact_number', label: 'Phone' },
        { key: 'license_number', label: 'License' },
        { key: 'rating', label: 'Rating' },
      ]}
      cellRenderer={(col, val) => {
        if (col.key === 'rating') {
          const r = Number(val || 0);
          const stars = '★'.repeat(Math.round(r)) + '☆'.repeat(5 - Math.round(r));
          return <span className="text-amber-500 font-medium">{stars} <span className="text-slate-500 text-xs">{r}</span></span>;
        }
        return null;
      }}
      clientValidate={(form) => {
        if (form.rating !== undefined && form.rating !== '') {
          const r = Number(form.rating);
          if (isNaN(r) || r < 0 || r > 5) return 'Rating must be between 0 and 5';
        }
        return null;
      }}
    />
  );
}

export default Suppliers;
