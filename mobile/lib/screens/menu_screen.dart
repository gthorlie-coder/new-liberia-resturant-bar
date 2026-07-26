import 'package:flutter/material.dart';
import '../models/menu_item.dart';
import '../services/api_client.dart';
import '../theme.dart';

class MenuScreen extends StatefulWidget {
  const MenuScreen({super.key, required this.branchId});

  final String branchId;

  @override
  State<MenuScreen> createState() => _MenuScreenState();
}

class _MenuScreenState extends State<MenuScreen> {
  final _api = ApiClient();
  late Future<List<MenuItem>> _future;

  @override
  void initState() {
    super.initState();
    _future = _loadMenu();
  }

  Future<List<MenuItem>> _loadMenu() async {
    final data = await _api.get('/branches/${widget.branchId}/menu-items');
    return (data['menu_items'] as List).map((e) => MenuItem.fromJson(e)).toList();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('New Liberia Restaurant & Bar')),
      body: FutureBuilder<List<MenuItem>>(
        future: _future,
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snapshot.hasError) {
            return Center(child: Text('Could not load the menu: ${snapshot.error}'));
          }
          final items = snapshot.data ?? [];
          if (items.isEmpty) {
            return const Center(child: Text('No menu items yet.'));
          }
          return ListView.separated(
            padding: const EdgeInsets.all(16),
            itemCount: items.length,
            separatorBuilder: (_, __) => const SizedBox(height: 12),
            itemBuilder: (context, i) {
              final item = items[i];
              return Card(
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                child: ListTile(
                  contentPadding: const EdgeInsets.all(12),
                  title: Text(item.name, style: const TextStyle(fontWeight: FontWeight.bold)),
                  subtitle: Text(item.description ?? ''),
                  trailing: Text(
                    '\$${item.price.toStringAsFixed(2)}',
                    style: const TextStyle(color: AppColors.gold, fontWeight: FontWeight.bold),
                  ),
                  enabled: item.isAvailable,
                ),
              );
            },
          );
        },
      ),
    );
  }
}
