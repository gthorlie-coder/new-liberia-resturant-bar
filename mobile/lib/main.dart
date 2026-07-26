import 'package:flutter/material.dart';
import 'package:firebase_core/firebase_core.dart';
import 'theme.dart';
import 'screens/menu_screen.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Firebase.initializeApp(); // requires firebase_options.dart from `flutterfire configure`
  runApp(const NewLiberiaApp());
}

class NewLiberiaApp extends StatelessWidget {
  const NewLiberiaApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'New Liberia Restaurant & Bar',
      theme: AppTheme.light,
      darkTheme: AppTheme.dark,
      themeMode: ThemeMode.system,
      debugShowCheckedModeBanner: false,
      // Replace with the real branch id once seeded via the admin dashboard.
      home: const MenuScreen(branchId: 'REPLACE_WITH_BRANCH_ID'),
    );
  }
}
