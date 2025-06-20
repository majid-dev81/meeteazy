// ✅ Full working version — identical layout with logging added

// ... (everything above remains unchanged)

{filteredRequests.length === 0 && <p className="text-gray-500">No requests.</p>}

<ul className="space-y-4">
  {filteredRequests.map((req) => (
    <li key={req.id} className="border rounded p-4">
      <p className="font-semibold">
        {req.name} ({req.email})
      </p>
      <p>
        {req.day} at {req.time}
      </p>
      {req.subject && <p>Subject: {req.subject}</p>}
      <p>
        Status: <span className="font-medium capitalize">{req.status}</span>
      </p>
      {req.status === 'pending' && (
        <div className="mt-2 space-x-2">
          <button
            onClick={() => {
              console.log('✅ Accept clicked for', req.id)
              handleStatusUpdate(req.id, 'accepted')
            }}
            className="bg-blue-600 text-white px-3 py-1 rounded"
          >
            Accept
          </button>
          <button
            onClick={() => {
              console.log('❌ Decline clicked for', req.id)
              handleStatusUpdate(req.id, 'declined')
            }}
            className="bg-gray-400 text-white px-3 py-1 rounded"
          >
            Decline
          </button>
        </div>
      )}
    </li>
  ))}
</ul>